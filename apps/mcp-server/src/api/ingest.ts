/**
 * UVS Ingestion API Endpoints
 * 
 * REST API endpoints for ingesting vehicle data from various providers
 */

import express from 'express';
import { ingestVehiclesFromProvider, type IngestionServiceOptions } from '../ingestion/service.js';
import {
  SYNDICATION_MAX_ROWS,
  buildDealershipInventoryUrl,
} from '../ingestion/marketcheckSyndication.js';
import { authorizeIngestRequest, resolveDeletionStrategy } from '../lib/ingestAuth.js';
import pino from 'pino';

const logger = (pino as any)();
const MARKETCHECK_DEFAULT_BASE = 'https://api.marketcheck.com';

/**
 * Create ingestion API router
 */
export function createIngestionRouter(): express.Router {
  const router = express.Router();
  
  // Parse JSON bodies
  router.use(express.json());
  
  router.use((req, res, next) => {
    const auth = authorizeIngestRequest(
      { authorization: req.headers.authorization },
      process.env.INGESTION_API_TOKEN,
    );
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    next();
  });
  
  /**
   * POST /api/ingest/marketcheck/fetch-and-ingest
   * Enrolled-dealer sync via Cars Dealer Inventory Syndication
   * GET /v2/dealerships/inventory (24h cache allowed). Not live search.
   */
  router.post('/marketcheck/fetch-and-ingest', async (req, res) => {
    const {
      dealerId,
      source,
      pageSize,
      page = 1,
      // Safety rails: MarketCheck pagination behavior can be inconsistent.
      // These caps prevent runaway loops and excessively large ingestions.
      maxPages = 10,
      maxVehicles = 5000,
    } = req.body || {};

    const apiKey = process.env.MARKETCHECK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'MARKETCHECK_API_KEY not configured' });
    }

    if (!dealerId && !source) {
      return res.status(400).json({ error: 'dealerId or source is required' });
    }

    const baseUrl = (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');

    try {
      logger.info({
        event: 'marketcheck_syndication_fetch_start',
        endpoint: '/v2/dealerships/inventory',
        dealerId,
        source,
        page,
        pageSize,
        maxPages,
        maxVehicles,
      });

      // Syndication paid max is 1,500 rows; ignore smaller pageSize from callers.
      let effectivePageSize = SYNDICATION_MAX_ROWS;

      const buildUrlForPage = (_pageNum: number, _useOffsetBased = false, actualStartOffset?: number) => {
        const start = actualStartOffset !== undefined ? actualStartOffset : 0;
        return buildDealershipInventoryUrl(baseUrl, {
          apiKey,
          dealerId,
          source,
          start,
          rows: effectivePageSize,
        });
      };

      const allVehicles: any[] = [];
      const seenIds = new Set<string>();
      let duplicatesSkipped = 0;
      let pagesFetched = 0;
      let numFound: number | null = null;
      let useOffsetBased = true;
      let actualStartOffset = 0;

      let currentPage = Number.isFinite(Number(page)) ? Number(page) : 1;
      if (currentPage < 1) currentPage = 1;

      while (pagesFetched < maxPages && allVehicles.length < maxVehicles) {
        // Check if we've already fetched all vehicles (based on actual count, not offset)
        if (typeof numFound === 'number' && allVehicles.length >= numFound) {
          logger.info({
            event: 'marketcheck_pagination_complete',
            dealerId,
            source,
            totalUnique: allVehicles.length,
            numFound,
            pagesFetched,
            message: 'Fetched all vehicles according to num_found',
          });
          break;
        }

        const url = buildUrlForPage(currentPage, useOffsetBased, useOffsetBased ? actualStartOffset : undefined);

      logger.info({
          event: 'marketcheck_fetch_page_start',
        dealerId,
        source,
          page: currentPage,
          pageSizeRequested: effectivePageSize,
          useOffsetBased,
          numFound: numFound ?? null,
        url: url.replace(apiKey, '***REDACTED***'),
      });

      // Retry logic for 429 rate limit errors with exponential backoff
      let response: Response;
      let retryCount = 0;
      const maxRetries = 3;
      const baseDelayMs = 1000; // Start with 1 second

      // Always execute at least once, then retry if needed
      do {
        response = await fetch(url, { cache: 'no-store' });
        
        // If 429 (rate limit), retry with exponential backoff
        if (response.status === 429 && retryCount < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, retryCount); // 1s, 2s, 4s
          logger.warn({
            event: 'marketcheck_rate_limit_retry',
            dealerId,
            source,
            page: currentPage,
            retryCount: retryCount + 1,
            maxRetries,
            delayMs,
            message: `Rate limit hit (429), retrying after ${delayMs}ms`,
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          retryCount++;
        } else {
          // Not a 429 or max retries reached, exit loop
          break;
        }
      } while (retryCount <= maxRetries);

      // At this point, response is guaranteed to be set (from the while loop)
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        // If it's a 422 about start > num_found, we've reached the end
        if (response.status === 422 && errorText.includes('Start parameter greater than num_found')) {
          logger.info({
            event: 'marketcheck_pagination_reached_end_422',
            dealerId,
            source,
            page: currentPage,
            numFound: numFound ?? null,
            totalUnique: allVehicles.length,
            message: 'MarketCheck returned 422: start > num_found; all vehicles fetched',
          });
          break;
        }
        // If 422 about pagination limit, switch to offset-based with smaller rows and retry
        if (response.status === 422 && errorText.includes('pagination limit')) {
          const newPageSize = Math.max(10, Math.floor(effectivePageSize / 2));
          logger.warn({
            event: 'marketcheck_pagination_limit_422_retry_offset',
            dealerId,
            source,
            page: currentPage,
            previousPageSize: effectivePageSize,
            newPageSize,
            message: 'Pagination limit hit; switching to offset-based pagination with smaller rows',
          });
          useOffsetBased = true;
          effectivePageSize = newPageSize;
          currentPage = 1;
          actualStartOffset = 0;
          seenIds.clear();
          allVehicles.length = 0;
          pagesFetched = 0;
          numFound = null;
          continue;
        }
        // If 429 after retries, return error
        if (response.status === 429) {
          logger.error({
            event: 'marketcheck_rate_limit_exceeded',
            dealerId,
            source,
            page: currentPage,
            retriesAttempted: retryCount,
            message: 'Rate limit exceeded after retries',
          });
          return res.status(429).json({
            error: 'MarketCheck rate limit exceeded',
            details: 'Too many requests. Please wait a few minutes and try again.',
          });
        }
        return res.status(response.status).json({
          error: `MarketCheck request failed (${response.status})`,
          details: errorText.substring(0, 500),
        });
      }

        const payload = await response.json();
        const vehicles = Array.isArray(payload.listings) ? payload.listings : [];
        pagesFetched += 1;

        // Update num_found if we get a new value (it might change between pages)
        if (typeof payload.num_found === 'number') {
          if (numFound === null) {
            numFound = payload.num_found;
          } else if (payload.num_found !== numFound) {
            // num_found changed - log it but use the latest value
            logger.warn({
              event: 'marketcheck_num_found_changed',
              dealerId,
              source,
              oldNumFound: numFound,
              newNumFound: payload.num_found,
            });
            numFound = payload.num_found;
          }
        }

        // Log sample IDs from this page for debugging
        const sampleIds = vehicles.slice(0, 3).map((v: any) => ({
          id: v?.id,
          vin: v?.vin,
          stock_no: v?.stock_no,
        }));

        let newOnThisPage = 0;
        const duplicateIds: string[] = [];
        for (const v of vehicles) {
          const id = (v && (v.id || v.vin)) ? String(v.id || v.vin) : undefined;
          if (!id) {
            // If no stable ID, include it but don't use it for progress detection.
            allVehicles.push(v);
            newOnThisPage += 1;
            continue;
          }
          if (seenIds.has(id)) {
            duplicatesSkipped += 1;
            if (duplicateIds.length < 5) duplicateIds.push(id);
            continue;
          }
          seenIds.add(id);
          allVehicles.push(v);
          newOnThisPage += 1;
          if (allVehicles.length >= maxVehicles) break;
        }

      logger.info({
          event: 'marketcheck_fetch_page_complete',
        dealerId,
        source,
          page: currentPage,
          listingsReturned: vehicles.length,
          newUniqueThisPage: newOnThisPage,
          totalUniqueSoFar: allVehicles.length,
          numFound: numFound ?? null,
          sampleIds: sampleIds.length > 0 ? sampleIds : undefined,
          duplicateIdsSample: duplicateIds.length > 0 ? duplicateIds : undefined,
          payloadKeys: Object.keys(payload),
        });

        // Stop conditions:
        if (vehicles.length === 0) {
          logger.info({
            event: 'marketcheck_pagination_empty_page',
            dealerId,
            source,
            page: currentPage,
            totalUnique: allVehicles.length,
            numFound: numFound ?? null,
            message: 'MarketCheck returned empty page; stopping pagination',
          });
          break;
        }
        
        if (newOnThisPage === 0 && pagesFetched > 1) {
          // If page-based pagination failed and we haven't tried offset-based yet, switch
          if (!useOffsetBased && currentPage === 2) {
            logger.warn({
              event: 'marketcheck_pagination_switch_to_offset',
              dealerId,
              source,
              page: currentPage,
              message: 'Page-based pagination returned duplicates, switching to offset-based (start/rows)',
            });
            useOffsetBased = true;
            currentPage = 1; // Reset to page 1 with offset-based
            actualStartOffset = 0; // Reset offset
            seenIds.clear(); // Clear seen IDs to start fresh
            allVehicles.length = 0; // Clear vehicles to start fresh
            pagesFetched = 0; // Reset page count
            continue; // Retry with offset-based pagination
          }
          
          // page param ignored / looped results; don't spin forever.
          logger.warn({
            event: 'marketcheck_pagination_no_progress',
            dealerId,
            source,
            page: currentPage,
            pagesFetched,
            totalUnique: allVehicles.length,
            numFound: numFound ?? null,
            useOffsetBased,
            message: 'No new vehicles were discovered on this page; stopping pagination',
            sampleIds: sampleIds.length > 0 ? sampleIds : undefined,
            duplicateIdsSample: duplicateIds.length > 0 ? duplicateIds : undefined,
          });
          break;
        }
        
        if (typeof numFound === 'number' && allVehicles.length >= numFound) {
          logger.info({
            event: 'marketcheck_pagination_complete',
            dealerId,
            source,
            totalUnique: allVehicles.length,
            numFound,
            pagesFetched,
            message: 'Fetched all vehicles according to num_found',
          });
          break;
        }

        // For offset-based pagination, increment by actual vehicles returned (not pageSize)
        // MarketCheck only returns 10 vehicles per page, so we increment by 10
        if (useOffsetBased) {
          actualStartOffset += vehicles.length; // Increment by actual vehicles returned
        }
        
        // Rate limiting: Add delay between requests to respect 5 calls/second limit
        // Free plan allows 5 calls/second = 200ms minimum between calls
        // Using 250ms to be safe and account for network latency
        if (pagesFetched < maxPages && allVehicles.length < maxVehicles) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        
        currentPage += 1;
      }

      if (allVehicles.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No vehicles returned from MarketCheck',
          fetched: 0,
          pagesFetched,
          numFound,
          duplicatesSkipped,
          ingested: 0,
        });
      }

      logger.info({
        event: 'marketcheck_fetch_complete',
        dealerId,
        source,
        fetchedUnique: allVehicles.length,
        pagesFetched,
        numFound,
        duplicatesSkipped,
      });

      const ingestionOptions: IngestionServiceOptions = {
        provider: 'marketcheck',
        dataSource: 'marketcheck-api',
        dealerId,
        // Deletions are only safe when scoped to a dealer.
        deletionStrategy: dealerId ? 'mark_unavailable' : 'none',
        timeoutMs: 30000,
        batchSize: 100,
        continueOnError: true,
      };

      if (!dealerId) {
        logger.warn({
          event: 'marketcheck_ingest_deletions_disabled_missing_dealerId',
          source,
          message: 'dealerId not provided; disabling deletionStrategy to avoid cross-dealer updates',
        });
      }

      const ingestResult = await ingestVehiclesFromProvider(allVehicles, ingestionOptions);

      return res.json({
        success: true,
        fetched: allVehicles.length,
        pagesFetched,
        numFound,
        duplicatesSkipped,
        ingestion: ingestResult,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error({
        event: 'marketcheck_fetch_ingest_error',
        dealerId,
        source,
        error: errorMessage,
        stack: errorStack,
      });
      
      return res.status(500).json({
        error: errorMessage,
        details: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined,
      });
    }
  });
  
  /**
   * POST /api/ingest/marketcheck
   * Ingest vehicles from MarketCheck provider
   */
  router.post('/marketcheck', async (req, res) => {
    try {
      const { vehicles, options } = req.body;
      
      if (!Array.isArray(vehicles)) {
        return res.status(400).json({ error: 'vehicles must be an array' });
      }
      
      const ingestionOptions: IngestionServiceOptions = {
        provider: 'marketcheck',
        dataSource: options?.dataSource || 'marketcheck-api',
        dealerId: options?.dealerId,
        timeoutMs: options?.timeoutMs || 30000,
        batchSize: options?.batchSize || 100,
        continueOnError: options?.continueOnError !== false,
        ...options,
        dealerId: options?.dealerId,
        deletionStrategy: resolveDeletionStrategy(
          options?.deletionStrategy || 'mark_unavailable',
          options?.dealerId,
          'mark_unavailable',
        ),
      };
      
      logger.info({
        event: 'ingestion_api_request',
        provider: 'marketcheck',
        vehicleCount: vehicles.length,
        options: ingestionOptions,
      });
      
      const result = await ingestVehiclesFromProvider(vehicles, ingestionOptions);
      
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error({
        event: 'ingestion_api_error',
        provider: 'marketcheck',
        error: errorMessage,
        stack: errorStack,
        vehicleCount: req.body?.vehicles?.length || 0,
        hasOptions: !!req.body?.options,
      });
      
      // Enhanced error response with more context
      res.status(500).json({
        error: errorMessage,
        details: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined,
        provider: 'marketcheck',
      });
    }
  });
  
  /**
   * POST /api/ingest/csv
   * Ingest vehicles from CSV import
   */
  router.post('/csv', async (req, res) => {
    try {
      const { vehicles, options } = req.body;
      
      if (!Array.isArray(vehicles)) {
        return res.status(400).json({ error: 'vehicles must be an array' });
      }
      
      const ingestionOptions: IngestionServiceOptions = {
        provider: 'csv-import',
        dataSource: options?.dataSource || 'csv-import',
        dealerId: options?.dealerId,
        deletionStrategy: options?.deletionStrategy || 'none',
        timeoutMs: options?.timeoutMs || 30000,
        batchSize: options?.batchSize || 100,
        continueOnError: options?.continueOnError !== false,
        ...options,
      };
      
      const result = await ingestVehiclesFromProvider(vehicles, ingestionOptions);
      
      res.json(result);
    } catch (error) {
      logger.error({
        event: 'ingestion_api_error',
        provider: 'csv',
        error: error instanceof Error ? error.message : String(error),
      });
      
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
  
  /**
   * POST /api/ingest/dealer-api
   * Ingest vehicles from dealer API
   */
  router.post('/dealer-api', async (req, res) => {
    try {
      const { vehicles, options } = req.body;
      
      if (!Array.isArray(vehicles)) {
        return res.status(400).json({ error: 'vehicles must be an array' });
      }
      
      const ingestionOptions: IngestionServiceOptions = {
        provider: 'dealer-api',
        dataSource: options?.dataSource || 'dealer-api',
        dealerId: options?.dealerId,
        timeoutMs: options?.timeoutMs || 30000,
        batchSize: options?.batchSize || 100,
        continueOnError: options?.continueOnError !== false,
        ...options,
        dealerId: options?.dealerId,
        deletionStrategy: resolveDeletionStrategy(
          options?.deletionStrategy || 'mark_unavailable',
          options?.dealerId,
          'mark_unavailable',
        ),
      };
      
      const result = await ingestVehiclesFromProvider(vehicles, ingestionOptions);
      
      res.json(result);
    } catch (error) {
      logger.error({
        event: 'ingestion_api_error',
        provider: 'dealer-api',
        error: error instanceof Error ? error.message : String(error),
      });
      
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
  
  /**
   * POST /api/ingest/:provider
   * Generic ingestion endpoint for any provider
   */
  router.post('/:provider', async (req, res) => {
    try {
      const { provider } = req.params;
      const { vehicles, options } = req.body;
      
      if (!Array.isArray(vehicles)) {
        return res.status(400).json({ error: 'vehicles must be an array' });
      }
      
      const validProviders = ['marketcheck', 'csv-import', 'dealer-api', 'dealer-com', 'homenet', 'vauto'];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ 
          error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` 
        });
      }
      
      const ingestionOptions: IngestionServiceOptions = {
        provider: provider as any,
        dataSource: options?.dataSource || provider,
        dealerId: options?.dealerId,
        timeoutMs: options?.timeoutMs || 30000,
        batchSize: options?.batchSize || 100,
        continueOnError: options?.continueOnError !== false,
        ...options,
        dealerId: options?.dealerId,
        deletionStrategy: resolveDeletionStrategy(
          options?.deletionStrategy || 'mark_unavailable',
          options?.dealerId,
          'mark_unavailable',
        ),
      };
      
      const result = await ingestVehiclesFromProvider(vehicles, ingestionOptions);
      
      res.json(result);
    } catch (error) {
      logger.error({
        event: 'ingestion_api_error',
        provider: req.params.provider,
        error: error instanceof Error ? error.message : String(error),
      });
      
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
  
  return router;
}

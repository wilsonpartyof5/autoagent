/**
 * UVS Ingestion API Endpoints
 * 
 * REST API endpoints for ingesting vehicle data from various providers
 */

import express from 'express';
import { ingestVehiclesFromProvider, type IngestionServiceOptions } from '../ingestion/service.js';
import { CONFIG } from '../config/env.js';
import pino from 'pino';

const logger = (pino as any)();
const MARKETCHECK_DEFAULT_BASE = 'https://api.marketcheck.com';
const MARKETCHECK_SOURCE_BASE = 'https://mc-api.marketcheck.com';

/**
 * Create ingestion API router
 */
export function createIngestionRouter(): express.Router {
  const router = express.Router();
  
  // Parse JSON bodies
  router.use(express.json());
  
  // Authentication middleware (simple bearer token check)
  router.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : req.query.token as string;
    
    // For now, allow if no token is required or if token matches env var
    // In production, use proper authentication
    const requiredToken = process.env.INGESTION_API_TOKEN;
    if (requiredToken && token !== requiredToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
  });
  
  /**
   * POST /api/ingest/marketcheck/fetch-and-ingest
   * End-to-end sync: fetch from MarketCheck then ingest into UVS
   */
  router.post('/marketcheck/fetch-and-ingest', async (req, res) => {
    const {
      dealerId,
      source,
      zip,
      radiusMiles = 50,
      condition = 'all',
      pageSize = 100,
      page = 1,
      // Safety rails: MarketCheck pagination behavior can be inconsistent.
      // These caps prevent runaway loops and excessively large ingestions.
      maxPages = 50,
      maxVehicles = 5000,
    } = req.body || {};

    const apiKey = process.env.MARKETCHECK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'MARKETCHECK_API_KEY not configured' });
    }

    if (!dealerId && !source) {
      return res.status(400).json({ error: 'dealerId or source is required' });
    }

    const useSourceEndpoint = !!source;
    const baseUrl = useSourceEndpoint
      ? MARKETCHECK_SOURCE_BASE
      : (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');

    const endpoint = useSourceEndpoint
      ? '/v2/car/dealer/inventory/active'
      : '/v2/search/car/active';

    // Normalize URL construction to prevent double slashes
    const normalizedBase = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const normalizedEndpoint = endpoint.replace(/^\/+/, '/'); // Ensure single leading slash

    try {
      logger.info({
        event: 'marketcheck_fetch_start',
        dealerId,
        source,
        page,
        pageSize,
        maxPages,
        maxVehicles,
      });

      const buildUrlForPage = (pageNum: number) => {
        const searchParams = new URLSearchParams({
          api_key: apiKey,
          page: String(pageNum),
          pageSize: String(pageSize),
        });

        if (useSourceEndpoint) {
          searchParams.set('source', source);
        } else {
          searchParams.set('dealer_id', dealerId);
          if (zip) searchParams.set('zip', zip);
          if (radiusMiles) searchParams.set('radius', String(radiusMiles));
          if (condition === 'new') searchParams.set('car_type', 'new');
          if (condition === 'used') searchParams.set('car_type', 'used');
        }

        return `${normalizedBase}${normalizedEndpoint}?${searchParams.toString()}`;
      };

      const allVehicles: any[] = [];
      const seenIds = new Set<string>();
      let duplicatesSkipped = 0;
      let pagesFetched = 0;
      let numFound: number | null = null;

      let currentPage = Number.isFinite(Number(page)) ? Number(page) : 1;
      if (currentPage < 1) currentPage = 1;

      while (pagesFetched < maxPages && allVehicles.length < maxVehicles) {
        const url = buildUrlForPage(currentPage);

        logger.info({
          event: 'marketcheck_fetch_page_start',
          dealerId,
          source,
          page: currentPage,
          pageSizeRequested: pageSize,
          url: url.replace(apiKey, '***REDACTED***'),
        });

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          return res.status(response.status).json({
            error: `MarketCheck request failed (${response.status})`,
            details: errorText.substring(0, 500),
          });
        }

        const payload = await response.json();
        const vehicles = Array.isArray(payload.listings) ? payload.listings : [];
        pagesFetched += 1;

        if (numFound === null && typeof payload.num_found === 'number') {
          numFound = payload.num_found;
        }

        let newOnThisPage = 0;
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
        });

        // Stop conditions:
        if (vehicles.length === 0) break;
        if (newOnThisPage === 0) {
          // page param ignored / looped results; don't spin forever.
          logger.warn({
            event: 'marketcheck_pagination_no_progress',
            dealerId,
            source,
            page: currentPage,
            message: 'No new vehicles were discovered on this page; stopping pagination',
          });
          break;
        }
        if (typeof numFound === 'number' && allVehicles.length >= numFound) break;

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
        deletionStrategy: options?.deletionStrategy || 'mark_unavailable',
        timeoutMs: options?.timeoutMs || 30000,
        batchSize: options?.batchSize || 100,
        continueOnError: options?.continueOnError !== false,
        ...options,
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
        deletionStrategy: options?.deletionStrategy || 'mark_unavailable',
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
        deletionStrategy: options?.deletionStrategy || 'mark_unavailable',
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

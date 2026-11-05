import { marketCheckSubject, withMarketCheckContext } from '../marketcheck/context';
import {
  getVehicleDetailMcp,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
  searchActiveCarsMcp,
  type LiveSearchFilters,
  type LiveSearchResult,
  type DetailResponse,
} from '../marketcheck/mcp-adapter';
import { payloadContainsSecret, redactSecrets } from '../marketcheck/secrets';

import { publicListingFromDetail, publicListingFromSearchVehicle, publicListingsContainForbiddenKey, assertPublicListing } from './allowlist';
import { discoverClientIp, hashIpForLogs } from './client-ip';
import { CORS_HEADERS, DISCOVER_SEARCH_MAX_PAGE } from './constants';
import { DiscoverApiError, discoverErrorBody, type DiscoverErrorCode } from './errors';
import { enforceDiscoverRateLimit, type RateLimitStore } from './rate-limit';
import { parseDiscoverSearchBody, parseJsonBody, parseListingId } from './schema';

export type DiscoverSearchPort = (params: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  filters?: LiveSearchFilters;
  rows?: number;
  start?: number;
}) => Promise<LiveSearchResult>;

export type DiscoverDetailPort = (listingId: string) => Promise<DetailResponse | null>;

export type DiscoverHandlerDeps = {
  nowMs?: number;
  rateLimitStore?: RateLimitStore;
  search?: DiscoverSearchPort;
  detail?: DiscoverDetailPort;
  origin?: string;
};

function mergeHeaders(...groups: Array<Record<string, string> | undefined>): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  for (const group of groups) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) headers.set(key, value);
  }
  return headers;
}

export function discoverOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: mergeHeaders() });
}

function jsonResponse(status: number, body: unknown, extra?: Record<string, string>): Response {
  if (payloadContainsSecret(body) || publicListingsContainForbiddenKey(body)) {
    return new Response(
      JSON.stringify(discoverErrorBody('UPSTREAM_ERROR', 'An error occurred while loading listings.')),
      { status: 502, headers: mergeHeaders(extra) },
    );
  }
  return new Response(JSON.stringify(body), { status, headers: mergeHeaders(extra) });
}

function toLiveFilters(input: ReturnType<typeof parseDiscoverSearchBody>['filters']): LiveSearchFilters {
  const filters: LiveSearchFilters = {};
  if (input.make) filters.make = input.make;
  if (input.model) filters.model = input.model;
  if (input.trim) filters.trim = input.trim;
  if (input.year) filters.year = input.year;
  if (input.year_min) filters.minYear = input.year_min;
  if (input.year_max) filters.maxYear = input.year_max;
  if (input.price_min) filters.minPrice = input.price_min;
  if (input.price_max) filters.maxPrice = input.price_max;
  if (input.miles_max) filters.maxMiles = input.miles_max;
  if (input.condition) filters.condition = input.condition;
  if (input.body_type) filters.bodyType = input.body_type;
  return filters;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return parseJsonBody(await request.json());
  } catch (error) {
    if (error instanceof DiscoverApiError) throw error;
    throw new DiscoverApiError('INVALID_REQUEST', 'Invalid JSON in request body');
  }
}

function mapUpstream(error: unknown): DiscoverApiError {
  if (error instanceof DiscoverApiError) return error;
  if (error instanceof MarketCheckRateLimitError) {
    const retry: Record<string, string> = {};
    if (error.retryAfter) retry['Retry-After'] = String(error.retryAfter);
    return new DiscoverApiError('RATE_LIMITED', 'Inventory is busy. Please wait and try again.', retry);
  }
  if (error instanceof MarketCheckQuotaError) {
    return new DiscoverApiError('UPSTREAM_ERROR', 'Inventory is temporarily unavailable. Please try again later.');
  }
  console.error(JSON.stringify({
    event: 'discover_upstream_error',
    error: redactSecrets(error instanceof Error ? error.message : String(error)),
  }));
  return new DiscoverApiError('UPSTREAM_ERROR', 'Inventory is temporarily unavailable. Please try again later.');
}

function respondError(error: unknown, rateHeaders?: Record<string, string>): Response {
  const mapped = error instanceof DiscoverApiError ? error : mapUpstream(error);
  return jsonResponse(mapped.status, discoverErrorBody(mapped.code as DiscoverErrorCode, mapped.message), {
    ...rateHeaders,
    ...mapped.extraHeaders,
  });
}

const defaultSearch: DiscoverSearchPort = (params) => searchActiveCarsMcp(params);
const defaultDetail: DiscoverDetailPort = (listingId) => getVehicleDetailMcp(listingId, undefined, ['listing']);

export async function handleDiscoverSearch(request: Request, deps: DiscoverHandlerDeps = {}): Promise<Response> {
  const ip = discoverClientIp(request.headers);
  let rateHeaders: Record<string, string> | undefined;
  try {
    const limited = await enforceDiscoverRateLimit({
      ip,
      route: 'search',
      nowMs: deps.nowMs,
      store: deps.rateLimitStore,
    });
    rateHeaders = limited.headers;

    const body = parseDiscoverSearchBody(await readJson(request));
    const filters = toLiveFilters(body.filters);
    const start = (body.page - 1) * body.page_size;
    const origin = deps.origin ?? new URL(request.url).origin;

    console.log(JSON.stringify({
      event: 'discover_search_start',
      ipHash: hashIpForLogs(ip),
      page: body.page,
      pageSize: body.page_size,
      radiusMiles: body.radius_miles,
      hasFilters: Object.keys(filters).length > 0,
    }));

    const result = await withMarketCheckContext({ origin }, () =>
      (deps.search ?? defaultSearch)({
        latitude: body.latitude,
        longitude: body.longitude,
        radiusMiles: body.radius_miles,
        filters,
        rows: body.page_size,
        start,
      }),
    );

    if (result.upstreamFailed) {
      throw new DiscoverApiError('UPSTREAM_ERROR', 'Inventory is temporarily unavailable. Please try again later.');
    }

    const listings = result.vehicles
      .map((vehicle) => publicListingFromSearchVehicle(vehicle, body))
      .filter((listing): listing is NonNullable<typeof listing> => listing != null)
      .map(assertPublicListing);

    const total = Math.min(result.numFound > 0 ? result.numFound : listings.length, DISCOVER_SEARCH_MAX_PAGE * body.page_size);
    const totalPages = Math.max(1, Math.ceil(total / body.page_size));

    return jsonResponse(200, {
      success: true,
      data: {
        listings,
        pagination: {
          page: body.page,
          page_size: body.page_size,
          total,
          total_pages: totalPages,
          has_next_page: body.page < totalPages && listings.length >= body.page_size,
          has_previous_page: body.page > 1,
        },
      },
    }, rateHeaders);
  } catch (error) {
    return respondError(error, rateHeaders);
  }
}

export async function handleDiscoverListing(
  request: Request,
  listingIdRaw: string | undefined,
  deps: DiscoverHandlerDeps = {},
): Promise<Response> {
  const ip = discoverClientIp(request.headers);
  let rateHeaders: Record<string, string> | undefined;
  try {
    const limited = await enforceDiscoverRateLimit({
      ip,
      route: 'detail',
      nowMs: deps.nowMs,
      store: deps.rateLimitStore,
    });
    rateHeaders = limited.headers;

    const listingId = parseListingId(listingIdRaw);
    const origin = deps.origin ?? new URL(request.url).origin;

    const detail = await withMarketCheckContext(
      { origin, subject: marketCheckSubject(undefined, request.headers.get('x-drevvy-subject')) },
      () => (deps.detail ?? defaultDetail)(listingId),
    );
    if (!detail) {
      throw new DiscoverApiError('LISTING_NOT_FOUND', 'This listing is no longer available.');
    }

    const listing = publicListingFromDetail(detail);
    if (!listing) {
      throw new DiscoverApiError('LISTING_NOT_FOUND', 'This listing is no longer available.');
    }

    return jsonResponse(200, { success: true, data: assertPublicListing(listing) }, rateHeaders);
  } catch (error) {
    return respondError(error, rateHeaders);
  }
}

export const DISCOVER_ERROR_CODES = [
  'INVALID_REQUEST',
  'INVALID_LOCATION',
  'INVALID_FILTERS',
  'INVALID_PAGINATION',
  'INVALID_ID',
  'LISTING_NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'RATE_LIMIT_UNAVAILABLE',
] as const;

export type DiscoverErrorCode = (typeof DISCOVER_ERROR_CODES)[number];

export const DISCOVER_ERROR_STATUS: Record<DiscoverErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_LOCATION: 400,
  INVALID_FILTERS: 400,
  INVALID_PAGINATION: 400,
  INVALID_ID: 400,
  LISTING_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  RATE_LIMIT_UNAVAILABLE: 503,
};

export class DiscoverApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: DiscoverErrorCode,
    message: string,
    readonly extraHeaders: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'DiscoverApiError';
    this.status = DISCOVER_ERROR_STATUS[code];
  }
}

export function discoverErrorBody(code: DiscoverErrorCode, message: string) {
  return { success: false as const, error: { code, message } };
}

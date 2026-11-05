export const DISCOVER_SEARCH_MAX_RADIUS_MILES = 50;
export const DISCOVER_SEARCH_MIN_RADIUS_MILES = 5;
export const DISCOVER_SEARCH_DEFAULT_RADIUS_MILES = 25;
export const DISCOVER_SEARCH_MAX_PAGE = 10;
export const DISCOVER_SEARCH_MAX_PAGE_SIZE = 20;
export const DISCOVER_SEARCH_DEFAULT_PAGE_SIZE = 10;

export const DISCOVER_BODY_TYPES = [
  'Pickup',
  'SUV',
  'Sedan',
  'Minivan',
  'Cargo Van',
  'Passenger Van',
  'Coupe',
  'Hatchback',
  'Wagon',
  'Convertible',
] as const;

export type DiscoverBodyType = (typeof DISCOVER_BODY_TYPES)[number];

export const LISTING_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export const DISCOVER_MINUTE_MS = 60_000;
export const DISCOVER_DAY_MS = 86_400_000;

export const DISCOVER_LIMITS = {
  search: {
    ipPerMinute: 20,
    globalPerMinute: 120,
    ipPerDay: 200,
    globalPerDay: 4_000,
  },
  detail: {
    ipPerMinute: 40,
    globalPerMinute: 240,
    ipPerDay: 400,
    globalPerDay: 8_000,
  },
} as const;

export type DiscoverRouteName = keyof typeof DISCOVER_LIMITS;

export const RATE_LIMIT_POLICY =
  'ip;w=60, global;w=60, ip-day;w=86400, global-day;w=86400';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Expose-Headers':
    'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, RateLimit-Policy, Retry-After',
  'Access-Control-Max-Age': '600',
};

import { z } from 'zod';

import {
  DISCOVER_BODY_TYPES,
  DISCOVER_SEARCH_DEFAULT_PAGE_SIZE,
  DISCOVER_SEARCH_DEFAULT_RADIUS_MILES,
  DISCOVER_SEARCH_MAX_PAGE,
  DISCOVER_SEARCH_MAX_PAGE_SIZE,
  DISCOVER_SEARCH_MAX_RADIUS_MILES,
  DISCOVER_SEARCH_MIN_RADIUS_MILES,
  LISTING_ID_PATTERN,
} from './constants';
import { DiscoverApiError } from './errors';

const MAX_YEAR = new Date().getFullYear() + 1;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .'-]{0,59}$/;

const optionalName = (max: number) =>
  z.string().trim().min(1).max(max).regex(NAME_PATTERN).optional();

export const discoverFiltersSchema = z
  .object({
    make: optionalName(40),
    model: optionalName(60),
    trim: optionalName(60),
    year: z.number().int().min(1990).max(MAX_YEAR).optional(),
    year_min: z.number().int().min(1990).max(MAX_YEAR).optional(),
    year_max: z.number().int().min(1990).max(MAX_YEAR).optional(),
    price_min: z.number().int().min(0).max(500_000).optional(),
    price_max: z.number().int().min(0).max(500_000).optional(),
    miles_max: z.number().int().min(0).max(400_000).optional(),
    condition: z.enum(['new', 'used', 'certified']).optional(),
    body_type: z.enum(DISCOVER_BODY_TYPES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.year != null && (value.year_min != null || value.year_max != null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'year cannot be combined with year_min or year_max',
        path: ['year'],
      });
    }
    if (value.year_min != null && value.year_max != null && value.year_min > value.year_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'year_min must be <= year_max',
        path: ['year_min'],
      });
    }
    if (value.price_min != null && value.price_max != null && value.price_min > value.price_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'price_min must be <= price_max',
        path: ['price_min'],
      });
    }
  });

export const discoverSearchSchema = z
  .object({
    latitude: z.number().finite().gte(-90).lte(90),
    longitude: z.number().finite().gte(-180).lte(180),
    radius_miles: z
      .number()
      .int()
      .min(DISCOVER_SEARCH_MIN_RADIUS_MILES)
      .max(DISCOVER_SEARCH_MAX_RADIUS_MILES)
      .optional()
      .default(DISCOVER_SEARCH_DEFAULT_RADIUS_MILES),
    page: z.number().int().min(1).max(DISCOVER_SEARCH_MAX_PAGE).optional().default(1),
    page_size: z
      .number()
      .int()
      .min(1)
      .max(DISCOVER_SEARCH_MAX_PAGE_SIZE)
      .optional()
      .default(DISCOVER_SEARCH_DEFAULT_PAGE_SIZE),
    filters: discoverFiltersSchema.optional().default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Math.abs(value.latitude) < 0.01 && Math.abs(value.longitude) < 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A real latitude and longitude are required. (0, 0) is not a search area.',
        path: ['latitude'],
      });
    }
  });

export type DiscoverSearchInput = z.infer<typeof discoverSearchSchema>;
export type DiscoverFiltersInput = z.infer<typeof discoverFiltersSchema>;

function issuePath(issue: z.ZodIssue): string {
  return issue.path.map(String).join('.');
}

export function parseDiscoverSearchBody(body: unknown): DiscoverSearchInput {
  const parsed = discoverSearchSchema.safeParse(body);
  if (parsed.success) return parsed.data;

  const issue = parsed.error.issues[0];
  const path = issue ? issuePath(issue) : '';
  const message = issue?.message ?? 'Invalid search request';

  if (path.startsWith('filters')) {
    throw new DiscoverApiError('INVALID_FILTERS', message);
  }
  if (path === 'page' || path === 'page_size') {
    throw new DiscoverApiError('INVALID_PAGINATION', message);
  }
  if (
    path === 'latitude' ||
    path === 'longitude' ||
    path === 'radius_miles' ||
    message.toLowerCase().includes('latitude') ||
    message.toLowerCase().includes('longitude')
  ) {
    throw new DiscoverApiError('INVALID_LOCATION', message);
  }
  throw new DiscoverApiError('INVALID_REQUEST', message);
}

export function parseListingId(raw: string | undefined): string {
  const id = raw?.trim() ?? '';
  if (!LISTING_ID_PATTERN.test(id)) {
    throw new DiscoverApiError('INVALID_ID', 'Invalid listing ID');
  }
  return id;
}

export function parseJsonBody(raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    throw new DiscoverApiError('INVALID_REQUEST', 'JSON body is required');
  }
  return raw;
}

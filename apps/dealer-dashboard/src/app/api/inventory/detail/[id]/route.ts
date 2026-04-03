import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/inventory/detail/[id]
 *
 * Vehicle Detail + Enrichment Endpoint — MVP consumer discovery mode.
 *
 * Called when a user opens a vehicle card. Fetches detailed listing data,
 * all media, extended features/options/seller comments, and dealer metadata
 * from MarketCheck in parallel. Enrichment is NOT performed during list search —
 * only here, on-demand.
 *
 * Path param:
 *   [id] — MarketCheck listing ID (returned as `id` in /api/inventory/search)
 *
 * Query params (optional):
 *   dealerId — dealer ID for enriched dealer info (returned as `location.dealerId` if present)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "abc123",
 *     "vin": "...",
 *     "year": 2023,
 *     "make": "Toyota",
 *     "model": "Camry",
 *     "trim": "XSE",
 *     "condition": "used",
 *     "price": 28999,
 *     "msrp": 32000,
 *     "miles": 24000,
 *     "bodyType": "Sedan",
 *     "exteriorColor": "White",
 *     "interiorColor": "Black",
 *     "drivetrain": "FWD",
 *     "fuelType": "Gasoline",
 *     "transmission": "Automatic",
 *     "sellerComments": "...",
 *     "description": "...",
 *     "features": [...],
 *     "options": [...],
 *     "photoUrls": [...],
 *     "videoUrl": "...",
 *     "daysOnMarket": 14,
 *     "location": {
 *       "dealerName": "...",
 *       "dealerCity": "...",
 *       "dealerState": "...",
 *       "dealerPhone": "...",
 *       "dealerWebsite": "...",
 *       "dealerAddress": "...",
 *       "latitude": 34.95,
 *       "longitude": -80.98,
 *       "dealerRating": 4.2,
 *       "dealerReviewCount": 87,
 *       "dealerHours": {...}
 *     },
 *     "enrichedAt": "2026-04-03T10:00:00.000Z",
 *     "partial": false
 *   }
 * }
 */

// -------------------------------------------------------------------------
// Config
// -------------------------------------------------------------------------

const MARKETCHECK_BASE_URL =
  (process.env.MARKETCHECK_BASE_URL ?? 'https://marketcheck-prod.apigee.net').replace(/\/$/, '');
const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY ?? '';

const ENDPOINT_TIMEOUT_MS = 6000;
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

// -------------------------------------------------------------------------
// Auth
// -------------------------------------------------------------------------

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  if (!apiKey) return false;
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7) === apiKey) return true;
  return false;
}

// -------------------------------------------------------------------------
// Raw types from MarketCheck
// -------------------------------------------------------------------------

interface MCListing {
  id?: string;
  vin?: string;
  price?: number;
  msrp?: number;
  dom?: number;
  inventory_type?: string;
  certified?: boolean;
  exterior_color?: string;
  interior_color?: string;
  miles?: number;
  mileage?: number;
  media?: {
    photo_links?: string[];
    photo_links_cached?: string[];
    primary_photo_url?: string;
    thumbnail?: { url?: string };
    video_url?: string;
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    drivetrain?: string;
    drive_train?: string;
    fuel_type?: string;
    transmission?: string;
  };
  dealer?: {
    id?: string | number;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number | string;
    longitude?: number | string;
    phone?: string;
    phone_formatted?: string;
    website?: string;
    email?: string;
    hours?: Record<string, string>;
    rating?: number;
    review_count?: number;
  };
}

interface MCMedia {
  photo_links?: string[];
  photo_links_cached?: string[];
  primary_photo_url?: string;
  thumbnail?: { url?: string };
  video_url?: string;
}

interface MCExtra {
  features?: string[];
  options?: Array<{ name?: string; code?: string; description?: string } | string>;
  seller_comments?: string;
  description?: string;
  specifications?: Record<string, unknown>;
}

type DetailOption = { name?: string; code?: string; description?: string };

function normalizeOptions(
  raw: MCExtra['options'],
): DetailOption[] | undefined {
  if (!raw?.length) return undefined;
  const first = raw[0];
  if (typeof first === 'string') {
    return raw.map((s) => (typeof s === 'string' ? { name: s } : {}));
  }
  return raw as DetailOption[];
}

interface MCDealer {
  id?: string | number;
  name?: string;
  street?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number | string;
  longitude?: number | string;
  phone?: string;
  phone_formatted?: string;
  website?: string;
  email?: string;
  hours?: Record<string, string>;
  rating?: number;
  review_count?: number;
  inventory_count?: number;
}

// -------------------------------------------------------------------------
// Per-endpoint fetch helpers
// -------------------------------------------------------------------------

class DetailQuotaError extends Error {
  readonly code = 'MARKETCHECK_QUOTA_EXCEEDED';
  constructor() {
    super('Monthly MarketCheck API quota reached. Upgrade your plan to continue.');
    this.name = 'DetailQuotaError';
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ENDPOINT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(tid);
    if (res.status === 404) return null;
    if (res.status === 402) {
      console.error(JSON.stringify({ event: 'mc_quota_exceeded', url: url.split('?')[0] }));
      throw new DetailQuotaError();
    }
    if (res.status === 429) {
      console.error(JSON.stringify({ event: 'mc_rate_limited', url: url.split('?')[0] }));
      return null; // detail endpoint: degrade gracefully on rate limit
    }
    if (!res.ok) {
      console.error(JSON.stringify({ event: 'mc_detail_fetch_error', url: url.split('?')[0], status: res.status }));
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DetailQuotaError) throw err;
    clearTimeout(tid);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error(JSON.stringify({
      event: isTimeout ? 'mc_detail_fetch_timeout' : 'mc_detail_fetch_exception',
      url: url.split('?')[0],
      error: err instanceof Error ? err.message : String(err),
    }));
    return null;
  }
}

/** Fire-and-forget usage tracking for detail calls */
async function trackDetailUsage(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const monthKey = new Date().toISOString().substring(0, 7);
  await fetch(`${url}/rest/v1/rpc/mc_usage_increment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_month: monthKey, p_call_type: 'detail' }),
    cache: 'no-store',
  });
}

// -------------------------------------------------------------------------
// Response shape
// -------------------------------------------------------------------------

interface DetailResponse {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: 'new' | 'used' | 'certified';
  price: number;
  msrp?: number;
  miles?: number;
  bodyType?: string;
  exteriorColor?: string;
  interiorColor?: string;
  drivetrain?: string;
  fuelType?: string;
  transmission?: string;
  sellerComments?: string;
  description?: string;
  features?: string[];
  options?: Array<{ name?: string; code?: string; description?: string }>;
  photoUrls?: string[];
  videoUrl?: string;
  daysOnMarket?: number;
  location: {
    latitude?: number;
    longitude?: number;
    dealerName: string;
    dealerCity?: string;
    dealerState?: string;
    dealerPhone?: string;
    dealerWebsite?: string;
    dealerAddress?: string;
    dealerRating?: number;
    dealerReviewCount?: number;
    dealerHours?: Record<string, string>;
  };
  enrichedAt: string;
  partial: boolean;
}

// -------------------------------------------------------------------------
// In-memory cache for detail responses
// -------------------------------------------------------------------------

const detailCache = new Map<string, { data: DetailResponse; expiresAt: number }>();

// -------------------------------------------------------------------------
// Route handler
// -------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const reqStart = Date.now();
  const { id: listingId } = await params;

  if (!listingId || !/^[a-zA-Z0-9_-]{4,64}$/.test(listingId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid listing ID' } },
      { status: 400 },
    );
  }

  try {

  if (!validateApiKey(request)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing API key',
        },
      },
      { status: 401 },
    );
  }

  if (!MARKETCHECK_API_KEY) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_ERROR', message: 'MarketCheck API not configured' } },
      { status: 500 },
    );
  }

  const dealerIdParam = request.nextUrl.searchParams.get('dealerId') ?? undefined;

  // Check cache
  const cached = detailCache.get(listingId);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(JSON.stringify({ event: 'mc_detail_cache_hit', listingId }));
    return NextResponse.json({ success: true, data: cached.data, fromCache: true });
  }

  console.log(JSON.stringify({
    event: 'mc_detail_start',
    listingId,
    dealerIdParam,
  }));

  // -----------------------------------------------------------------------
  // Fetch all enrichment endpoints in parallel
  // -----------------------------------------------------------------------
  const key = `api_key=${MARKETCHECK_API_KEY}`;
  const base = MARKETCHECK_BASE_URL;

  // Fire-and-forget usage tracking (4 parallel sub-calls count as 1 detail call)
  void trackDetailUsage().catch(() => {});

  const [detail, mediaWrapper, extra, dealerWrapper] = await Promise.all([
    fetchJson<MCListing>(`${base}/v2/listing/car/${listingId}?${key}`),
    fetchJson<{ media?: MCMedia }>(`${base}/v2/listing/car/${listingId}/media?${key}`),
    fetchJson<MCExtra>(`${base}/v2/listing/car/${listingId}/extra?${key}`),
    dealerIdParam
      ? fetchJson<{ dealer?: MCDealer }>(`${base}/v2/dealer/${dealerIdParam}?${key}`)
      : Promise.resolve(null),
  ]);

  const media = mediaWrapper?.media ?? null;
  const dealer = dealerWrapper?.dealer ?? null;

  const partial = !detail && !media && !extra && !dealer;

  if (partial) {
    const latencyMs = Date.now() - reqStart;
    console.error(JSON.stringify({
      event: 'mc_detail_not_found',
      listingId,
      latencyMs,
    }));
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LISTING_NOT_FOUND',
          message: 'Vehicle details are no longer available. The listing may have been sold or removed.',
        },
      },
      { status: 404 },
    );
  }

  // -----------------------------------------------------------------------
  // Build merged photos list
  // -----------------------------------------------------------------------
  const searchPhotos = [
    ...(detail?.media?.photo_links_cached?.filter(Boolean) ?? []),
    ...(detail?.media?.photo_links?.filter(Boolean) ?? []),
  ];
  const enrichedPhotos = [
    ...(media?.photo_links_cached?.filter(Boolean) ?? []),
    ...(media?.photo_links?.filter(Boolean) ?? []),
  ];
  const allPhotos = [...new Set([...searchPhotos, ...enrichedPhotos])];

  const primaryPhoto =
    media?.primary_photo_url ??
    detail?.media?.primary_photo_url ??
    media?.thumbnail?.url ??
    detail?.media?.thumbnail?.url ??
    allPhotos[0];

  if (primaryPhoto && !allPhotos.includes(primaryPhoto)) allPhotos.unshift(primaryPhoto);

  // -----------------------------------------------------------------------
  // Build features list
  // -----------------------------------------------------------------------
  const baseFeatures: string[] = detail?.build
    ? [
        detail.build.drivetrain,
        detail.build.drive_train,
        detail.build.transmission,
        detail.build.fuel_type,
        detail.build.trim,
      ].filter((v): v is string => Boolean(v))
    : [];
  const extraFeatures = extra?.features ?? [];
  const allFeatures = [...new Set([...baseFeatures, ...extraFeatures])];

  // -----------------------------------------------------------------------
  // Normalize condition
  // -----------------------------------------------------------------------
  let condition: 'new' | 'used' | 'certified' = 'used';
  if (detail?.inventory_type === 'new') condition = 'new';
  else if (detail?.inventory_type === 'cpo' || detail?.certified) condition = 'certified';

  // -----------------------------------------------------------------------
  // Dealer info: prefer enriched dealer endpoint, fall back to detail.dealer
  // -----------------------------------------------------------------------
  const dealerSource = dealer ?? detail?.dealer;

  const normalizeLat = (v?: number | string) => {
    if (v === undefined || v === null) return undefined;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? undefined : n;
  };

  // Normalize dealer website
  let dealerWebsite: string | undefined;
  const rawSite = dealer?.website ?? detail?.dealer?.website;
  if (rawSite) {
    const site = rawSite.trim();
    const withProto = site.startsWith('http') ? site : `https://${site}`;
    try {
      new URL(withProto);
      dealerWebsite = withProto;
    } catch {
      // invalid URL, skip
    }
  }

  const dealerAddressParts = [
    dealerSource?.street ?? (dealer as MCDealer | null)?.address,
    dealerSource?.city,
    dealerSource?.state,
    dealerSource?.zip,
  ].filter(Boolean);
  const dealerAddress = dealerAddressParts.length > 0 ? dealerAddressParts.join(', ') : undefined;

  /** MarketCheck sometimes returns options as string[]; iOS expects { name, code }[] */
  const normalizedOptions = normalizeOptions(extra?.options);

  const response: DetailResponse = {
    id: listingId,
    vin: detail?.vin,
    year: detail?.build?.year ?? new Date().getFullYear(),
    make: detail?.build?.make ?? 'Unknown',
    model: detail?.build?.model ?? 'Vehicle',
    trim: detail?.build?.trim,
    condition,
    price: Math.max(detail?.price ?? 0, 0),
    msrp: detail?.msrp,
    miles: (() => {
      const m = detail?.miles ?? detail?.mileage;
      return typeof m === 'number' ? Math.max(m, 0) : undefined;
    })(),
    bodyType: detail?.build?.body_type,
    exteriorColor: detail?.exterior_color,
    interiorColor: detail?.interior_color,
    drivetrain: detail?.build?.drivetrain ?? detail?.build?.drive_train,
    fuelType: detail?.build?.fuel_type,
    transmission: detail?.build?.transmission,
    sellerComments: extra?.seller_comments,
    description: extra?.description,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    options: normalizedOptions,
    photoUrls: allPhotos.length > 0 ? allPhotos : undefined,
    videoUrl: media?.video_url ?? detail?.media?.video_url,
    daysOnMarket: detail?.dom,
    location: {
      latitude: normalizeLat(dealerSource?.latitude),
      longitude: normalizeLat(dealerSource?.longitude),
      dealerName: dealerSource?.name ?? 'Unknown Dealer',
      dealerCity: dealerSource?.city,
      dealerState: dealerSource?.state,
      dealerPhone: dealer?.phone_formatted ?? dealer?.phone ?? detail?.dealer?.phone,
      dealerWebsite,
      dealerAddress,
      dealerRating: dealer?.rating,
      dealerReviewCount: dealer?.review_count,
      dealerHours: dealer?.hours,
    },
    enrichedAt: new Date().toISOString(),
    partial: !(detail && (media || extra || dealer)),
  };

  // Cache the enriched detail
  detailCache.set(listingId, { data: response, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });

  // Periodically prune old entries (5% of requests)
  if (Math.random() < 0.05) {
    const now = Date.now();
    for (const [k, v] of detailCache.entries()) {
      if (now > v.expiresAt) detailCache.delete(k);
    }
  }

  const latencyMs = Date.now() - reqStart;
  console.log(JSON.stringify({
    event: 'mc_detail_complete',
    listingId,
    partial: response.partial,
    hasDetail: !!detail,
    hasMedia: !!media,
    hasExtra: !!extra,
    hasDealer: !!dealer,
    photoCount: allPhotos.length,
    featureCount: allFeatures.length,
    latencyMs,
  }));

  return NextResponse.json({ success: true, data: response });

  } catch (error) {
    const latencyMs = Date.now() - reqStart;
    if (error instanceof DetailQuotaError) {
      console.error(JSON.stringify({ event: 'mc_detail_quota_exceeded', listingId, latencyMs }));
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 503 },
      );
    }
    console.error(JSON.stringify({
      event: 'mc_detail_error',
      listingId,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred fetching vehicle details.' } },
      { status: 500 },
    );
  }
}

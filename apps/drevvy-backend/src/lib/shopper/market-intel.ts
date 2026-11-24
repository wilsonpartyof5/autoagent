import { callMcpTool } from '@/lib/marketcheck/mcp-client';
import { FairPriceCappedError, fairPriceSpendEnabled, loadFairPriceIfAllowed } from '@/lib/marketcheck/price';
import { containsSecret, redactSecrets } from '@/lib/marketcheck/secrets';
import { loadMarketIntelV1, type MarketIntelV1 } from '@/lib/shopper/market-intel-v1';
import {
  getVehicleDetailMcp,
  searchActiveCarsMcp,
  type DetailResponse,
} from '@/lib/marketcheck/mcp-adapter';

/**
 * Marketplace Intelligence computed from MarketCheck.
 * Fair price is MarketCheck's quote. The band is the active comps that
 * arrived with that quote, or other live comps when the price source
 * does not include them. Nothing here invents a fee, a percent, or an
 * out-the-door number.
 */

export const MARKET_INTEL_KEYS = [
  'fairVehiclePrice',
  'lowPrice',
  'medianPrice',
  'highPrice',
  'comparablesCount',
  'daysListedMedian',
  'priceDrops',
  'isNewCar',
  'msrp',
  'msrpDiscount',
  'listedPrice',
  'source',
] as const;

export type MarketIntel = {
  fairVehiclePrice: number | null;
  lowPrice: number | null;
  medianPrice: number | null;
  highPrice: number | null;
  comparablesCount: number;
  daysListedMedian: number | null;
  priceDrops: number | null;
  isNewCar: boolean;
  msrp: number | null;
  msrpDiscount: number | null;
  listedPrice: number | null;
  source: 'marketcheck';
  /** Shopper card from market-intel v1. Absent on unlocks stored before v1. */
  v1?: MarketIntelV1;
};

export type ListingFacts = {
  id: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  condition: 'new' | 'used' | 'certified';
  price: number;
  msrp: number | null;
  miles: number | null;
  latitude: number | null;
  longitude: number | null;
  dealerZip: string | null;
  dealerType?: 'franchise' | 'independent' | null;
};

export type CompFact = {
  id: string;
  vin: string | null;
  price: number;
  daysOnMarket: number | null;
};

export type MarketIntelSources = {
  listing: (listingId: string, vin: string | null) => Promise<ListingFacts | null>;
  fairPrice: (vehicle: {
    vin: string;
    miles: number;
    zip: string;
    condition: 'used' | 'certified';
    dealerType?: 'franchise' | 'independent' | null;
  }) => Promise<{ price: number; comparables?: CompFact[] } | null>;
  comparables: (query: {
    latitude: number;
    longitude: number;
    year: number;
    make: string;
    model: string;
    condition: 'new' | 'used' | 'certified';
  }) => Promise<CompFact[]>;
  priceDrops: (listingId: string, vin: string | null) => Promise<number | null>;
};

const COMP_RADIUS_MILES = 50;
const COMP_ROWS = 25;
const MIN_COMPS = 3;

export function marketIntelHasValue(intel: MarketIntel | null | undefined): intel is MarketIntel {
  if (!intel || intel.source !== 'marketcheck') return false;
  if (intel.isNewCar) {
    return (intel.msrp ?? 0) > 0 && (intel.listedPrice ?? 0) > 0;
  }
  const low = intel.lowPrice;
  const median = intel.medianPrice;
  const high = intel.highPrice;
  return (intel.fairVehiclePrice ?? 0) > 0
    && intel.comparablesCount >= MIN_COMPS
    && low != null
    && low > 0
    && median != null
    && high != null
    && low <= median
    && median <= high;
}

export function presentMarketIntel(intel: MarketIntel): MarketIntel {
  const presented: MarketIntel = {
    fairVehiclePrice: intel.fairVehiclePrice,
    lowPrice: intel.lowPrice,
    medianPrice: intel.medianPrice,
    highPrice: intel.highPrice,
    comparablesCount: intel.comparablesCount,
    daysListedMedian: intel.daysListedMedian,
    priceDrops: intel.priceDrops,
    isNewCar: intel.isNewCar,
    msrp: intel.msrp,
    msrpDiscount: intel.msrpDiscount,
    listedPrice: intel.listedPrice,
    source: 'marketcheck',
  };
  if (intel.v1) presented.v1 = scrubMarketIntelV1(intel.v1);
  return presented;
}

export function marketIntelFromUnknown(value: unknown): MarketIntel | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.source !== 'marketcheck') return null;
  const intel = presentMarketIntel({
    fairVehiclePrice: whole(record.fairVehiclePrice),
    lowPrice: whole(record.lowPrice),
    medianPrice: whole(record.medianPrice),
    highPrice: whole(record.highPrice),
    comparablesCount: nonNegative(record.comparablesCount) ?? 0,
    daysListedMedian: nonNegative(record.daysListedMedian),
    priceDrops: nonNegative(record.priceDrops),
    isNewCar: record.isNewCar === true,
    msrp: positive(record.msrp),
    msrpDiscount: whole(record.msrpDiscount),
    listedPrice: positive(record.listedPrice),
    source: 'marketcheck',
    v1: readStoredV1(record.v1),
  });
  return marketIntelHasValue(intel) ? intel : null;
}

/** Count price decreases in MarketCheck history. Empty or unknown history is null. */
export function countPriceDrops(raw: unknown): number | null {
  const entries = historyEntries(raw);
  if (!entries) return null;
  const points = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const price = positive(record.price);
      const seen = seenAt(record);
      if (price == null || seen == null) return null;
      return { price, seen };
    })
    .filter((point): point is { price: number; seen: number } => point !== null)
    .sort((left, right) => left.seen - right.seen);
  if (points.length === 0) return null;
  let drops = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].price < points[index - 1].price) drops += 1;
  }
  return drops;
}

export function listingIdentityMatches(input: {
  requestedListingId: string;
  requestedVin: string | null;
  returnedListingId: string;
  returnedVin: string | null;
}): boolean {
  const requestedId = input.requestedListingId.trim();
  const returnedId = input.returnedListingId.trim();
  if (requestedId.length > 0) return returnedId.length > 0 && requestedId === returnedId;
  const requestedVin = (input.requestedVin ?? '').trim().toUpperCase();
  const returnedVin = (input.returnedVin ?? '').trim().toUpperCase();
  return requestedVin.length > 0 && requestedVin === returnedVin;
}

export type MarketIntelLookup = {
  intel: MarketIntel | null;
  listingFound: boolean;
  returnedListingId: string | null;
  /**
   * False when a miss must not be cached. A missing fair price refunds the
   * key and the shopper can retry. The 24-hour "no value" mark stays off.
   */
  cacheableMiss?: boolean;
};

export function asMarketIntelLookup(
  value: MarketIntel | MarketIntelLookup | null,
  requestedListingId: string,
): MarketIntelLookup {
  if (value && typeof value === 'object' && 'listingFound' in value && 'intel' in value) {
    const lookup = value as MarketIntelLookup;
    return {
      intel: lookup.intel ?? null,
      listingFound: lookup.listingFound === true,
      returnedListingId: typeof lookup.returnedListingId === 'string' ? lookup.returnedListingId : null,
      cacheableMiss: lookup.cacheableMiss,
    };
  }
  if (value && typeof value === 'object' && (value as MarketIntel).source === 'marketcheck') {
    return {
      intel: value as MarketIntel,
      listingFound: true,
      returnedListingId: requestedListingId,
    };
  }
  return { intel: null, listingFound: false, returnedListingId: null };
}

/** When a listing id was requested, the returned id has to match. A VIN match is not enough. */
export function acceptedListingFacts(
  requested: { listingId: string; vin: string | null },
  detail: DetailResponse,
): ListingFacts | null {
  if (!listingIdentityMatches({
    requestedListingId: requested.listingId,
    requestedVin: requested.vin,
    returnedListingId: detail.id,
    returnedVin: detail.vin ?? null,
  })) return null;
  return listingFactsFromDetail(requested.listingId, detail);
}

export function listingFactsFromDetail(listingId: string, detail: DetailResponse): ListingFacts | null {
  const make = detail.make?.trim() ?? '';
  const model = detail.model?.trim() ?? '';
  if (!make || !model || make === 'Unknown' || model === 'Vehicle' || !detail.year) return null;
  const vin = detail.vin?.trim().toUpperCase() || null;
  return {
    id: detail.id.trim(),
    vin,
    year: detail.year,
    make,
    model,
    condition: detail.condition,
    price: detail.price > 0 ? Math.round(detail.price) : 0,
    msrp: detail.msrp != null && detail.msrp > 0 ? Math.round(detail.msrp) : null,
    miles: typeof detail.miles === 'number' && detail.miles >= 0 ? Math.round(detail.miles) : null,
    latitude: typeof detail.location?.latitude === 'number' ? detail.location.latitude : null,
    longitude: typeof detail.location?.longitude === 'number' ? detail.location.longitude : null,
    dealerZip: fiveDigitZip(detail.location?.dealerZip),
    dealerType: detail.dealerType === 'independent' || detail.dealerType === 'franchise'
      ? detail.dealerType
      : null,
  };
}

export async function computeMarketIntel(
  input: { listingId: string; vin: string | null; profileZip: string | null },
  sources: MarketIntelSources,
): Promise<MarketIntel | null> {
  const facts = await sources.listing(input.listingId, input.vin);
  if (!facts) return null;

  if (facts.condition === 'new') {
    if (!facts.msrp || facts.price <= 0) return null;
    const priceDrops = await sources.priceDrops(input.listingId, facts.vin ?? input.vin);
    return presentMarketIntel({
      fairVehiclePrice: null,
      lowPrice: null,
      medianPrice: null,
      highPrice: null,
      comparablesCount: 0,
      daysListedMedian: null,
      priceDrops,
      isNewCar: true,
      msrp: facts.msrp,
      msrpDiscount: facts.msrp - facts.price,
      listedPrice: facts.price,
      source: 'marketcheck',
    });
  }

  const zip = facts.dealerZip ?? fiveDigitZip(input.profileZip);
  if (!facts.vin || facts.miles == null || !zip || facts.latitude == null || facts.longitude == null) {
    return null;
  }

  const quote = await sources.fairPrice({
    vin: facts.vin,
    miles: facts.miles,
    zip,
    condition: facts.condition === 'certified' ? 'certified' : 'used',
    dealerType: facts.dealerType,
  });
  if (!quote || quote.price <= 0) return null;

  const found = Array.isArray(quote.comparables)
    ? quote.comparables
    : await sources.comparables({
      latitude: facts.latitude,
      longitude: facts.longitude,
      year: facts.year,
      make: facts.make,
      model: facts.model,
      condition: facts.condition,
    });
  const comps = found
    .filter((comp) => comp.price > 0 && !isSubject(comp, facts, input.listingId));

  if (comps.length < MIN_COMPS) return null;

  const prices = comps.map((comp) => comp.price).sort((left, right) => left - right);
  const lowPrice = percentile(prices, 0.25);
  const medianPrice = percentile(prices, 0.5);
  const highPrice = percentile(prices, 0.75);
  const days = comps
    .map((comp) => comp.daysOnMarket)
    .filter((daysOnMarket): daysOnMarket is number => daysOnMarket != null && daysOnMarket >= 0)
    .sort((left, right) => left - right);

  const priceDrops = await sources.priceDrops(input.listingId, facts.vin ?? input.vin);
  const intel = presentMarketIntel({
    fairVehiclePrice: Math.round(quote.price),
    lowPrice,
    medianPrice,
    highPrice,
    comparablesCount: comps.length,
    daysListedMedian: days.length >= MIN_COMPS ? median(days) : null,
    priceDrops,
    isNewCar: false,
    msrp: facts.msrp,
    msrpDiscount: facts.msrp != null && facts.price > 0 ? facts.msrp - facts.price : null,
    listedPrice: facts.price > 0 ? facts.price : null,
    source: 'marketcheck',
  });
  return marketIntelHasValue(intel) ? intel : null;
}

export async function loadMarketIntelFromMarketCheck(input: {
  listingId: string;
  vin: string | null;
  profileZip: string | null;
  userId?: string | null;
}): Promise<MarketIntelLookup> {
  if (!fairPriceSpendEnabled()) {
    return { intel: null, listingFound: false, returnedListingId: null };
  }
  const detail = await getVehicleDetailMcp(input.listingId, input.vin ?? undefined, ['listing']);
  if (!detail) return { intel: null, listingFound: false, returnedListingId: null };
  const returnedListingId = detail.id.trim();
  const facts = acceptedListingFacts({ listingId: input.listingId, vin: input.vin }, detail);
  if (!facts) {
    return {
      intel: null,
      listingFound: returnedListingId.length > 0,
      returnedListingId: returnedListingId || null,
    };
  }
  let intel: MarketIntel | null;
  try {
    intel = await computeMarketIntel(input, {
    listing: async () => facts,
    fairPrice: async (vehicle) => {
      const quote = await loadFairPriceIfAllowed('unlock_with_agent', vehicle, {
        strict: true,
        userId: input.userId,
        purpose: 'market_intel',
      });
      if (!quote || quote.price <= 0) return null;
      if (Array.isArray(quote.comparables)) {
        return { price: quote.price, comparables: quote.comparables };
      }
      return { price: quote.price };
    },
    comparables: async (query) => {
      const result = await searchActiveCarsMcp({
        latitude: query.latitude,
        longitude: query.longitude,
        radiusMiles: COMP_RADIUS_MILES,
        rows: COMP_ROWS,
        filters: {
          year: query.year,
          make: query.make,
          model: query.model,
          condition: query.condition,
        },
      }, { strict: true });
      return result.vehicles
        .filter((vehicle) => vehicle.price > 0)
        .map((vehicle) => ({
          id: vehicle.listingId ?? vehicle.id,
          vin: vehicle.vin ?? null,
          price: Math.round(vehicle.price),
          daysOnMarket: vehicle.daysOnMarket ?? null,
        }));
    },
    priceDrops: async (listingId, vin) => {
      const raw = await callMcpTool<unknown>(
        'get_car_history',
        vin ? { vin } : { listing_id: listingId },
        8000,
        { strict: true },
      );
      if (raw == null) return null;
      return countPriceDrops(raw);
    },
  });
  } catch (error) {
    if (error instanceof FairPriceCappedError) {
      return { intel: null, listingFound: false, returnedListingId: null };
    }
    throw error;
  }
  return { intel, listingFound: true, returnedListingId: facts.id };
}

function isSubject(comp: CompFact, facts: ListingFacts, listingId: string): boolean {
  const subjectId = facts.id.trim() || (facts.vin ? '' : listingId);
  if (subjectId && comp.id === subjectId) return true;
  const vin = facts.vin?.toUpperCase();
  return Boolean(vin && comp.vin && comp.vin.toUpperCase() === vin);
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

function historyEntries(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.price_history)) {
    return record.price_history.length > 0 ? record.price_history : null;
  }
  const data = record.data;
  if (Array.isArray(data)) return data.length > 0 ? data : null;
  if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).price_history)) {
    const history = (data as Record<string, unknown>).price_history as unknown[];
    return history.length > 0 ? history : null;
  }
  return null;
}

function seenAt(record: Record<string, unknown>): number | null {
  if (typeof record.first_seen_at === 'number') return record.first_seen_at;
  if (typeof record.last_seen_at === 'number') return record.last_seen_at;
  if (typeof record.date === 'string') {
    const parsed = Date.parse(record.date);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function fiveDigitZip(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : null;
}

function whole(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function positive(value: unknown): number | null {
  const rounded = whole(value);
  return rounded != null && rounded > 0 ? rounded : null;
}

function nonNegative(value: unknown): number | null {
  const rounded = whole(value);
  return rounded != null && rounded >= 0 ? rounded : null;
}

function readStoredV1(value: unknown): MarketIntelV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.version !== 'v1' || !Array.isArray(record.lines)) return undefined;
  return scrubMarketIntelV1(record as MarketIntelV1);
}

function scrubMarketIntelV1(card: MarketIntelV1): MarketIntelV1 {
  const raw = JSON.stringify(card);
  if (!containsSecret(raw)) return card;
  return JSON.parse(redactSecrets(raw)) as MarketIntelV1;
}

function shownLine(card: MarketIntelV1, key: MarketIntelV1['lines'][number]['key']) {
  return card.lines.find((line) => line.key === key && line.shown);
}

/**
 * Legacy snapshot the existing unlock function can store, plus the v1 card.
 *
 * Used cars need a real fair price. No fair price is not stored: the key is
 * refunded and the shopper can retry. A displayed range is stored when it is
 * mile-matched. When the range is hidden, the middle-half percentiles are
 * stored only so the existing SQL value check can keep the unlock. The client
 * reads v1.similar and does not draw that hidden range.
 *
 * New cars need a shown deal score (the median used as the fair price) and a
 * real NeoVIN sticker, which is what the existing new-car check requires.
 * There is no out-the-door number on this object.
 */
export function toStoredMarketIntel(card: MarketIntelV1): MarketIntel | null {
  const deal = shownLine(card, 'deal_score');
  if (!deal) return null;
  const value = shownLine(card, 'value_since_new');
  const sticker = value ? positive(value.source.factorySticker) : null;
  const listed = card.askingPrice > 0 ? Math.round(card.askingPrice) : null;
  const time = shownLine(card, 'time_on_lot');
  const days = time ? nonNegative(time.source.similarMedianDays) : null;
  const drops = time && time.source.drops != null ? nonNegative(time.source.drops) : null;

  if (card.condition === 'new') {
    if ((card.fairPrice ?? positive(deal.source.fairPrice) ?? 0) <= 0) return null;
    if (!sticker || !listed) return null;
    return presentMarketIntel({
      fairVehiclePrice: null,
      lowPrice: null,
      medianPrice: null,
      highPrice: null,
      comparablesCount: card.similar?.count ?? 0,
      daysListedMedian: days,
      priceDrops: drops,
      isNewCar: true,
      msrp: sticker,
      msrpDiscount: sticker - listed,
      listedPrice: listed,
      source: 'marketcheck',
      v1: card,
    });
  }

  if ((card.fairPrice ?? 0) <= 0) return null;
  const band = storedUsedBand(card);
  if (!band) return null;
  return presentMarketIntel({
    fairVehiclePrice: Math.round(card.fairPrice!),
    lowPrice: band.low,
    medianPrice: band.median,
    highPrice: band.high,
    comparablesCount: band.count,
    daysListedMedian: days,
    priceDrops: drops,
    isNewCar: false,
    msrp: sticker,
    msrpDiscount: sticker != null && listed != null ? sticker - listed : null,
    listedPrice: listed,
    source: 'marketcheck',
    v1: card,
  });
}

function storedUsedBand(card: MarketIntelV1): { low: number; median: number; high: number; count: number } | null {
  const count = card.similar?.count ?? 0;
  if (count < 3) return null;
  const shown = card.similar;
  if (shown?.mileMatched && shown.low != null && shown.median != null && shown.high != null
    && shown.low > 0 && shown.low <= shown.median && shown.median <= shown.high) {
    return { low: shown.low, median: shown.median, high: shown.high, count };
  }
  const deal = shownLine(card, 'deal_score');
  const low = positive(deal?.source.p25);
  const median = positive(deal?.source.p50);
  const high = positive(deal?.source.p75);
  if (low != null && median != null && high != null && low <= median && median <= high) {
    return { low, median, high, count };
  }
  return null;
}

/**
 * Shopper unlock loader. Serves v1 lines. A card with no fair price, or a
 * card the existing unlock check cannot store, comes back as a miss that is
 * not cached, so the refunded key can be used again.
 */
export async function loadShopperMarketIntel(input: {
  listingId: string;
  vin: string | null;
  profileZip: string | null;
  userId?: string | null;
}): Promise<MarketIntelLookup> {
  if (!fairPriceSpendEnabled()) {
    return { intel: null, listingFound: false, returnedListingId: null, cacheableMiss: false };
  }
  try {
    const card = await loadMarketIntelV1({
      listingId: input.listingId,
      userId: input.userId,
      profileZip: input.profileZip,
    });
    if (!card) {
      return { intel: null, listingFound: false, returnedListingId: null, cacheableMiss: false };
    }
    const intel = card.listingId === input.listingId ? toStoredMarketIntel(card) : null;
    return {
      intel,
      listingFound: true,
      returnedListingId: card.listingId,
      cacheableMiss: intel != null,
    };
  } catch (error) {
    if (error instanceof FairPriceCappedError) {
      return { intel: null, listingFound: false, returnedListingId: null, cacheableMiss: false };
    }
    throw error;
  }
}

import { loadFairPriceIfAllowed } from '@/lib/marketcheck/price';
import { callMcpTool } from '@/lib/marketcheck/mcp-client';
import {
  getVehicleDetailMcp,
  searchActiveCarsMcp,
  type DetailResponse,
} from '@/lib/marketcheck/mcp-adapter';

/**
 * Marketplace Intelligence computed from MarketCheck.
 * Fair price is MarketCheck's quote. The band is other live comps.
 * Nothing here invents a fee, a percent, or an out-the-door number.
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
  }) => Promise<{ price: number } | null>;
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
  return {
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

export function listingFactsFromDetail(listingId: string, detail: DetailResponse): ListingFacts | null {
  const make = detail.make?.trim() ?? '';
  const model = detail.model?.trim() ?? '';
  if (!make || !model || make === 'Unknown' || model === 'Vehicle' || !detail.year) return null;
  const vin = detail.vin?.trim().toUpperCase() || null;
  return {
    id: listingId,
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
  });
  if (!quote || quote.price <= 0) return null;

  const comps = (await sources.comparables({
    latitude: facts.latitude,
    longitude: facts.longitude,
    year: facts.year,
    make: facts.make,
    model: facts.model,
    condition: facts.condition,
  }))
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
}): Promise<MarketIntel | null> {
  return computeMarketIntel(input, {
    listing: async (listingId, vin) => {
      const detail = await getVehicleDetailMcp(listingId, vin ?? undefined, ['listing']);
      return detail ? listingFactsFromDetail(listingId, detail) : null;
    },
    fairPrice: async (vehicle) => {
      const quote = await loadFairPriceIfAllowed('unlock_with_agent', vehicle);
      return quote && quote.price > 0 ? { price: quote.price } : null;
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
      });
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
      );
      if (raw == null) return null;
      return countPriceDrops(raw);
    },
  });
}

function isSubject(comp: CompFact, facts: ListingFacts, listingId: string): boolean {
  if (comp.id === listingId || comp.id === facts.id) return true;
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

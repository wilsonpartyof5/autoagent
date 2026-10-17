import { loadMarketCheck, marketCheckPriceCacheKey, zipArea } from './cache-policy';
import { callMcpTool } from './mcp-client';
import { redactSecrets } from './secrets';

/**
 * MarketCheck Price (fair price). Cached for 24 hours under VIN + ZIP area
 * + miles. Search, listing detail, VIN decode, and history are not cached.
 *
 * A shopper call is allowed only when they tap Unlock with agent or open a
 * deal. Browsing a listing does not load it. New cars are not priced.
 */

export const FAIR_PRICE_TRIGGERS = ['unlock_with_agent', 'open_deal'] as const;
export type FairPriceTrigger = (typeof FAIR_PRICE_TRIGGERS)[number];

export type FairPriceQuote = {
  price: number;
  fromCache: boolean;
};

export type FairPriceVehicle = {
  vin?: string;
  miles?: number;
  zip?: string;
  condition?: 'new' | 'used' | 'certified';
};

export function fairPriceTriggerAllowed(trigger: string): trigger is FairPriceTrigger {
  return (FAIR_PRICE_TRIGGERS as readonly string[]).includes(trigger);
}

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

export interface MarketCheckPrice {
  vin: string;
  miles: number;
  zip: string;
  price: number;
  fromCache: boolean;
}

export async function getMarketCheckPrice(
  input: { vin: string; miles: number; zip: string },
  now: () => number = Date.now,
): Promise<MarketCheckPrice | null> {
  const vin = input.vin.trim().toUpperCase();
  const zip = zipArea(input.zip);
  const miles = Math.round(input.miles);
  if (!VIN.test(vin) || zip.length !== 5 || !Number.isFinite(miles) || miles < 0 || miles > 2_000_000) {
    return null;
  }

  const key = marketCheckPriceCacheKey(vin, zip, miles);
  const { value, fromCache } = await loadMarketCheck(
    'marketcheck_price',
    key,
    () => fetchMarketCheckPrice(vin, miles, zip),
    now,
  );
  if (!value) return null;
  return { ...value, fromCache };
}

/**
 * Shopper fair price. Returns null without a MarketCheck call unless the
 * trigger is Unlock with agent or opening a deal, and the car is used or CPO
 * with a VIN, miles, and ZIP.
 */
export async function loadFairPriceIfAllowed(
  trigger: string,
  vehicle: FairPriceVehicle,
): Promise<FairPriceQuote | null> {
  if (!fairPriceTriggerAllowed(trigger)) return null;
  if (vehicle.condition === 'new') return null;
  if (!vehicle.vin || vehicle.miles == null || !vehicle.zip) return null;
  try {
    const quote = await getMarketCheckPrice({
      vin: vehicle.vin,
      miles: vehicle.miles,
      zip: vehicle.zip,
    });
    if (!quote) return null;
    return { price: quote.price, fromCache: quote.fromCache };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'marketcheck_price_failed',
      trigger,
      error: redactSecrets(error instanceof Error ? error.message : String(error)),
    }));
    return null;
  }
}

async function fetchMarketCheckPrice(
  vin: string,
  miles: number,
  zip: string,
): Promise<Omit<MarketCheckPrice, 'fromCache'> | null> {
  const raw = await callMcpTool<unknown>('get_marketcheck_price', { vin, miles, zip });
  const price = readPrice(raw);
  if (price == null) return null;
  return { vin, miles, zip, price };
}

function readPrice(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;
  const candidate = nested.marketcheck_price ?? nested.price ?? record.marketcheck_price ?? record.price;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) return null;
  return Math.round(candidate);
}

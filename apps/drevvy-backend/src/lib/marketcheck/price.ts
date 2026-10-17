import { loadMarketCheck, marketCheckPriceCacheKey, zipArea } from './cache-policy';
import { callMcpTool } from './mcp-client';

/**
 * MarketCheck Price (fair price). Cached for 24 hours under VIN + ZIP area
 * + miles. Search, listing detail, VIN decode, and history are not cached.
 */

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

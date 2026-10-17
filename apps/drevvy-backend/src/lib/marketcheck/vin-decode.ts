import { loadMarketCheck } from './cache-policy';
import { McpQuotaError, McpRateLimitError } from './mcp-client';
import { redactSecrets } from './secrets';
import { recordMarketCheckCall } from './usage';

/**
 * Basic VIN decoder (`GET /v2/decode/car/{vin}/specs`).
 *
 * NeoVIN (`decode_vin_neovin`) is not used. Basic decode is not cached:
 * MarketCheck sales terms forbid storing VIN decode. Simultaneous identical
 * requests share one in-flight call, then the promise is dropped.
 */

export const DECODE_VIN_BASIC_ENDPOINT = 'decode_vin_basic';

/**
 * Specs-card rows and the Basic decoder fields that fill them.
 * History is the listing's one-owner flag, loaded on tap, not a decode field.
 */
export const SPECS_CARD_FROM_BASIC = {
  powertrain: 'engine',
  drivetrain: 'drivetrain',
  fuelEconomyCity: 'city_mpg',
  fuelEconomyHighway: 'highway_mpg',
  seats: 'std_seating',
  transmission: 'transmission',
} as const;

/**
 * Specs-card fields the Basic decoder does not return.
 * Horsepower is appended to Powertrain only when a decode includes it.
 * Combined MPG is added to fuel economy only when a decode includes it.
 */
export const BASIC_DECODER_MISSING_SPECS_FIELDS = ['horsepower', 'combinedMpg'] as const;

export type BasicVinSpecs = {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyType?: string;
  drivetrain?: string;
  fuelType?: string;
  transmission?: string;
  engine?: string;
  cityMpg?: number;
  highwayMpg?: number;
  seatingCapacity?: number;
  powertrainType?: string;
};

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function mapBasicVinDecode(raw: unknown): BasicVinSpecs | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;
  if (nested.is_valid === false) return null;

  const specs: BasicVinSpecs = {};
  assignInt(specs, 'year', finiteInt(nested.year));
  assignText(specs, 'make', text(nested.make));
  assignText(specs, 'model', text(nested.model));
  assignText(specs, 'trim', text(nested.trim));
  assignText(specs, 'bodyType', text(nested.body_type));
  assignText(specs, 'drivetrain', text(nested.drivetrain));
  assignText(specs, 'fuelType', text(nested.fuel_type));
  assignText(specs, 'transmission', text(nested.transmission));
  assignText(specs, 'engine', text(nested.engine));
  assignInt(specs, 'cityMpg', finiteInt(nested.city_mpg));
  assignInt(specs, 'highwayMpg', finiteInt(nested.highway_mpg));
  assignInt(specs, 'seatingCapacity', seating(nested.std_seating));
  assignText(specs, 'powertrainType', text(nested.powertrain_type));
  return Object.keys(specs).length > 0 ? specs : null;
}

export async function decodeVinBasic(vin: string): Promise<BasicVinSpecs | null> {
  const normalized = vin.trim().toUpperCase();
  if (!VIN.test(normalized)) return null;
  const { value } = await loadMarketCheck(
    'decode_vin_basic',
    normalized,
    () => fetchBasicVinDecode(normalized),
  );
  return value;
}

function marketCheckBaseUrl(): string {
  return (process.env.MARKETCHECK_BASE_URL ?? 'https://api.marketcheck.com').replace(/\/+$/, '');
}

async function fetchBasicVinDecode(vin: string): Promise<BasicVinSpecs | null> {
  const apiKey = process.env.MARKETCHECK_API_KEY ?? '';
  if (!apiKey) throw new Error('MARKETCHECK_API_KEY is not configured');

  recordMarketCheckCall(DECODE_VIN_BASIC_ENDPOINT);

  const url = `${marketCheckBaseUrl()}/v2/decode/car/${encodeURIComponent(vin)}/specs?api_key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(tid);

    if (res.status === 402) throw new McpQuotaError();
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      throw new McpRateLimitError(Number.isNaN(retryAfter) ? 60 : retryAfter);
    }
    if (res.status === 404 || res.status === 422) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(JSON.stringify({
        event: 'mc_basic_decode_http_error',
        status: res.status,
        body: redactSecrets(body.substring(0, 300)),
      }));
      return null;
    }
    return mapBasicVinDecode(await res.json());
  } catch (err) {
    clearTimeout(tid);
    if (err instanceof McpQuotaError || err instanceof McpRateLimitError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: 'mc_basic_decode_exception',
      error: redactSecrets(message),
    }));
    return null;
  }
}

function assignText(specs: BasicVinSpecs, key: keyof BasicVinSpecs, value: string | undefined): void {
  if (value) (specs[key] as string | undefined) = value;
}

function assignInt(specs: BasicVinSpecs, key: keyof BasicVinSpecs, value: number | undefined): void {
  if (value != null) (specs[key] as number | undefined) = value;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function finiteInt(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed);
}

function seating(value: unknown): number | undefined {
  if (typeof value === 'number') return finiteInt(value);
  if (typeof value !== 'string') return undefined;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  return finiteInt(Number(match[0]));
}

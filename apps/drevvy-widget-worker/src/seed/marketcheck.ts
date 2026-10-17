import { RESEARCH_USER_AGENT } from '../research/job';
import { siteUrlFromVehiclePage } from '../research/urls';
import { assertLaunchArea, type LaunchArea } from './areas';

/**
 * Name and website taken from a MarketCheck dealer record.
 * Phone and email are unverified hints for the research step.
 * Listing fields are not read and are not returned.
 */
export type DealerHint = {
  name: string | null;
  siteUrl: string;
  phone: string | null;
  email: string | null;
};

const HINT_KEYS = ['name', 'siteUrl', 'phone', 'email'] as const;

export function dealerHintKeys(): readonly string[] {
  return HINT_KEYS;
}

export function readDealerPage(payload: unknown): { count: number; numFound: number | null; hints: DealerHint[] } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('MarketCheck dealers response was not an object.');
  }
  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.dealers)) {
    if (Array.isArray(body.listings)) {
      throw new Error('MarketCheck returned listings. The seed only accepts the dealers list.');
    }
    throw new Error('MarketCheck response did not include a dealers list.');
  }
  return {
    count: body.dealers.length,
    numFound: finiteCount(body.num_found),
    hints: dealerHintsFromRecords(body.dealers),
  };
}

export function dealerHintsFromRecords(records: unknown[]): DealerHint[] {
  const hints: DealerHint[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const hint = hintFromDealerRecord(record);
    if (!hint || seen.has(hint.siteUrl)) continue;
    seen.add(hint.siteUrl);
    hints.push(hint);
  }
  return hints;
}

export async function listMarketCheckDealers(input: {
  area: LaunchArea;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  pace: () => Promise<void>;
  fetchImpl?: typeof fetch;
  rows?: number;
  maxPages?: number;
  log?: (line: string) => void;
}): Promise<DealerHint[]> {
  assertLaunchArea(input.area);
  if (!input.apiKey.trim()) throw new Error('MARKETCHECK_API_KEY is required to seed the directory.');
  const rows = input.rows ?? 50;
  const maxPages = input.maxPages ?? 40;
  const fetchImpl = input.fetchImpl ?? fetch;
  const log = input.log ?? (() => undefined);
  const hints: DealerHint[] = [];
  const seen = new Set<string>();
  let start = 0;

  for (let page = 0; page < maxPages; page += 1) {
    await input.pace();
    const payload = await requestDealers(input, fetchImpl, rows, start);
    const parsed = readDealerPage(payload);
    for (const hint of parsed.hints) {
      if (seen.has(hint.siteUrl)) continue;
      seen.add(hint.siteUrl);
      hints.push(hint);
    }
    start += parsed.count;
    if (parsed.count < rows) break;
    if (parsed.numFound != null && start >= parsed.numFound) break;
    if (page === maxPages - 1) {
      log(`MarketCheck ZIP ${input.area.zip} returned the page cap of ${maxPages}; some dealers were not listed.`);
    }
  }
  return hints;
}

async function requestDealers(
  input: { area: LaunchArea; apiKey: string; baseUrl: string; timeoutMs: number },
  fetchImpl: typeof fetch,
  rows: number,
  start: number,
): Promise<unknown> {
  const url = dealerSearchUrl(input, rows, start);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(input.timeoutMs),
      headers: {
        accept: 'application/json',
        'user-agent': RESEARCH_USER_AGENT,
      },
    });
  } catch {
    throw new Error(`MarketCheck dealers request failed for ZIP ${input.area.zip}.`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`MarketCheck dealers request was redirected for ZIP ${input.area.zip}.`);
  }
  if (!response.ok) {
    throw new Error(`MarketCheck dealers request failed for ZIP ${input.area.zip} (${response.status}).`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`MarketCheck dealers response was not JSON for ZIP ${input.area.zip}.`);
  }
}

function dealerSearchUrl(
  input: { area: LaunchArea; apiKey: string; baseUrl: string },
  rows: number,
  start: number,
): string {
  let url: URL;
  try {
    url = new URL('/v2/dealers/car', input.baseUrl);
  } catch {
    throw new Error('MARKETCHECK_BASE_URL is not a URL.');
  }
  url.searchParams.set('api_key', input.apiKey);
  url.searchParams.set('zip', input.area.zip);
  url.searchParams.set('radius', String(input.area.radiusMiles));
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('start', String(start));
  return url.toString();
}

function hintFromDealerRecord(record: unknown): DealerHint | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const row = record as Record<string, unknown>;
  const website = stringField(row, 'inventory_url') ?? stringField(row, 'website');
  if (!website) return null;
  const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  let siteUrl: string;
  try {
    siteUrl = siteUrlFromVehiclePage(withScheme);
  } catch {
    return null;
  }
  return {
    name: cleanHintName(stringField(row, 'seller_name') ?? stringField(row, 'name')),
    siteUrl,
    phone: cleanHintContact(stringField(row, 'seller_phone') ?? stringField(row, 'phone')),
    email: cleanHintContact(stringField(row, 'seller_email') ?? stringField(row, 'email')),
  };
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanHintName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 120) return null;
  if (/https?:|@/.test(trimmed)) return null;
  return trimmed;
}

function cleanHintContact(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

function finiteCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

/**
 * Deterministic shopper-ask parse.
 *
 * Runs before the model and again when the gateway and direct OpenAI calls
 * are both missing or both fail. It does not call a network API. City and
 * ZIP text is geocoded later by geocodeLocation.
 */

import type { ParsedFilters, ParseOpenAIResult } from './parse-inventory-query';
import { parseQueryWithOpenAI, scrubShopperMessage, toMapboxPlace } from './parse-inventory-query';
import {
  ASK_PARSE_MAX_TOKENS,
  callAskModel,
  type AskModelContext,
  type AskModelResult,
} from '../shopper/ask-model';

const TRUCKS: Array<{ pattern: RegExp; make: string; model: string }> = [
  { pattern: /\bf[-\s]?350s?\b/i, make: 'Ford', model: 'F-350' },
  { pattern: /\b350s\b/i, make: 'Ford', model: 'F-350' },
  { pattern: /\bf[-\s]?250s?\b/i, make: 'Ford', model: 'F-250' },
  { pattern: /\b250s\b/i, make: 'Ford', model: 'F-250' },
  { pattern: /\bf[-\s]?150s?\b/i, make: 'Ford', model: 'F-150' },
  { pattern: /\b150s\b/i, make: 'Ford', model: 'F-150' },
  { pattern: /\bram\s*3500s?\b/i, make: 'RAM', model: '3500' },
  { pattern: /\bram\s*2500s?\b/i, make: 'RAM', model: '2500' },
  { pattern: /\brams?\b/i, make: 'RAM', model: '1500' },
  { pattern: /\bsilverados?\b/i, make: 'Chevrolet', model: 'Silverado' },
  { pattern: /\btundras?\b/i, make: 'Toyota', model: 'Tundra' },
];

const STATE_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  al: 'AL',
  ak: 'AK',
  az: 'AZ',
  ar: 'AR',
  ca: 'CA',
  co: 'CO',
  ct: 'CT',
  de: 'DE',
  dc: 'DC',
  fl: 'FL',
  ga: 'GA',
  hi: 'HI',
  id: 'ID',
  il: 'IL',
  in: 'IN',
  ia: 'IA',
  ks: 'KS',
  ky: 'KY',
  la: 'LA',
  me: 'ME',
  md: 'MD',
  ma: 'MA',
  mi: 'MI',
  mn: 'MN',
  ms: 'MS',
  mo: 'MO',
  mt: 'MT',
  ne: 'NE',
  nv: 'NV',
  nh: 'NH',
  nj: 'NJ',
  nm: 'NM',
  ny: 'NY',
  nc: 'NC',
  nd: 'ND',
  oh: 'OH',
  ok: 'OK',
  or: 'OR',
  pa: 'PA',
  ri: 'RI',
  sc: 'SC',
  sd: 'SD',
  tn: 'TN',
  tx: 'TX',
  ut: 'UT',
  vt: 'VT',
  va: 'VA',
  wa: 'WA',
  wv: 'WV',
  wi: 'WI',
  wy: 'WY',
};

const STATE_ALTERNATION = Object.keys(STATE_ABBR)
  .sort((left, right) => right.length - left.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const CITY_STATE = new RegExp(
  `\\b(?:in|near)\\s+([a-z][a-z.'-]*(?:\\s+[a-z][a-z.'-]*){0,3})\\s*,?\\s+(${STATE_ALTERNATION})\\b`,
  'i',
);

const NEAR_ZIP = /\bnear\s+(\d{5})(?:-\d{4})?\b/i;

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function parseTruck(text: string): { make: string; model: string } | null {
  for (const truck of TRUCKS) {
    if (truck.pattern.test(text)) return { make: truck.make, model: truck.model };
  }
  return null;
}

function parsePrices(text: string): { minPrice?: number; maxPrice?: number } {
  const pattern = /(?:\b(under|below|less than|over|above|more than|at least)\s+)?\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s*[kK])?\b/gi;
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  for (const match of text.matchAll(pattern)) {
    const direction = match[1]?.toLowerCase();
    const raw = match[2] ?? '';
    const kilo = match[3];
    const index = match.index ?? 0;
    const prefix = text.slice(Math.max(0, index - 16), index);
    if (/^\d{5}$/.test(raw) && /(?:\bnear|\bin)\s+$/i.test(prefix)) continue;
    const hasMoneyMark = Boolean(kilo) || raw.includes(',') || (match[0] ?? '').includes('$');
    if (!hasMoneyMark && !direction) {
      const bare = Number(raw);
      if (bare < 1000 || (bare >= 1900 && bare <= 2035)) continue;
    }
    let amount = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (kilo) amount *= 1000;
    amount = Math.round(amount);
    if (amount <= 0 || amount > 500_000) continue;
    const isMin = direction === 'over' || direction === 'above' || direction === 'more than' || direction === 'at least';
    if (isMin) {
      if (minPrice == null) minPrice = amount;
    } else if (maxPrice == null) {
      maxPrice = amount;
    }
  }
  return { minPrice, maxPrice };
}

function parseLocation(text: string): string | undefined {
  const city = CITY_STATE.exec(text);
  if (city?.[1] && city[2]) {
    const abbr = STATE_ABBR[city[2].toLowerCase()];
    if (abbr) return `${titleCase(city[1])}, ${abbr}`;
  }
  const zip = NEAR_ZIP.exec(text);
  if (zip?.[1]) return zip[1];
  return undefined;
}

export function deterministicParse(message: string): ParseOpenAIResult {
  const text = message.trim();
  const filters: ParsedFilters = {};
  const explicitFields: string[] = [];

  const truck = parseTruck(text);
  if (truck) {
    filters.make = truck.make;
    filters.model = truck.model;
    filters.bodyType = 'Pickup';
    explicitFields.push('make', 'model', 'bodyType');
  }

  const prices = parsePrices(text);
  if (prices.minPrice != null) {
    filters.minPrice = prices.minPrice;
    explicitFields.push('minPrice');
  }
  if (prices.maxPrice != null) {
    filters.maxPrice = prices.maxPrice;
    explicitFields.push('maxPrice');
  }

  const locationText = parseLocation(text);
  if (locationText) {
    filters.locationText = locationText;
    explicitFields.push('locationText');
  }

  const confidence = explicitFields.length > 0
    ? Math.min(0.9, 0.4 + explicitFields.length * 0.1)
    : 0;
  return { filters, explicitFields, confidence };
}

export function mergeAskParses(
  deterministic: ParseOpenAIResult,
  llm: ParseOpenAIResult | null,
): ParseOpenAIResult | null {
  if (!llm && deterministic.explicitFields.length === 0) return null;
  if (!llm) return deterministic;

  const filters: ParsedFilters = { ...llm.filters };
  const explicit = new Set(llm.explicitFields);
  for (const field of deterministic.explicitFields) {
    const key = field as keyof ParsedFilters;
    const value = deterministic.filters[key];
    if (value == null || value === '') continue;
    filters[key] = value as never;
    explicit.add(field);
  }
  if (explicit.size === 0) return null;
  return {
    filters,
    explicitFields: [...explicit],
    confidence: Math.max(llm.confidence, deterministic.confidence),
  };
}

/**
 * Pre-parse with the deterministic rules, then fill from the gateway or,
 * when that credential is missing or rejects the call, from OpenAI directly.
 * Model failures keep the pre-parse.
 */
export async function parseAskQuery(
  message: string,
  options: {
    env?: Record<string, string | undefined>;
    parseWithModel?: (message: string) => Promise<ParseOpenAIResult>;
    askModel?: <T>(
      env: Record<string, string | undefined>,
      run: (ctx: AskModelContext) => Promise<T>,
    ) => Promise<AskModelResult<T>>;
    onProvider?: (provider: 'gateway' | 'openai' | 'parser') => void;
  } = {},
): Promise<ParseOpenAIResult | null> {
  const deterministic = deterministicParse(message);
  const env = options.env ?? process.env;
  const forModel = scrubShopperMessage(message);
  if (options.parseWithModel) {
    try {
      const llm = await options.parseWithModel(forModel);
      return placeSafeParse(mergeAskParses(deterministic, llm));
    } catch {
      options.onProvider?.('parser');
      return placeSafeParse(mergeAskParses(deterministic, null));
    }
  }

  const askModel = options.askModel ?? callAskModel;
  const called = await askModel(env, (ctx) => parseQueryWithOpenAI(forModel, {
    signal: ctx.signal,
    maxTokens: ASK_PARSE_MAX_TOKENS,
    client: ctx.client,
    model: ctx.model,
    preserveError: true,
  }));
  options.onProvider?.(called.ok ? called.provider : 'parser');
  return placeSafeParse(mergeAskParses(deterministic, called.ok ? called.value : null));
}

function placeSafeParse(parsed: ParseOpenAIResult | null): ParseOpenAIResult | null {
  if (!parsed?.filters.locationText) return parsed;
  const place = toMapboxPlace(parsed.filters.locationText);
  if (!place) {
    const explicitFields = parsed.explicitFields.filter((field) => field !== 'locationText');
    const filters = { ...parsed.filters };
    delete filters.locationText;
    return { ...parsed, filters, explicitFields };
  }
  return { ...parsed, filters: { ...parsed.filters, locationText: place } };
}

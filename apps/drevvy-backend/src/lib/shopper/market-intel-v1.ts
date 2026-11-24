/**
 * Market Intelligence v1 (the Know step, one key).
 *
 * Rule: show only what MarketCheck returned and what we can truthfully say
 * from it. A line with no real data is hidden, never filled in.
 *
 * v1 lines: deal score, same car cheaper nearby, miles vs similar,
 * how fast these sell, similar cars that left the market, time on the lot
 * and price drops, value since new (used) or price vs sticker (new), and
 * real maker deals (new).
 *
 * Similar cars are picked by how alike they are (same year, same trim,
 * close miles), not by distance. Distance only widens until there are
 * enough cars to compare.
 */
import { callMcpTool, MarketCheckUpstreamError, McpQuotaError, McpRateLimitError } from '@/lib/marketcheck/mcp-client';
import { fairPriceSpendEnabled, loadFairPriceIfAllowed, type FairPriceComp } from '@/lib/marketcheck/price';
import { marketCheckGet } from '@/lib/marketcheck/rest';

export const MIN_SIMILAR = 10;
export const MIN_SHOW = 3;
/** Miles window for "close miles", as a share of this car's miles. Widens once. */
export const MILES_WINDOWS = [0.25, 0.4] as const;
/** Radius steps used to widen the similar set from MarketCheck's price comps; Infinity is any distance. */
export const RADIUS_STEPS = [50, 100, 200, 500, Infinity] as const;
/**
 * Live search radius steps. The Free plan refuses radius over 100 miles
 * (422 "Subscribed package radius limit of 100 miles exceeded").
 * Used cars then fall back to the price comps (they carry distance up to ~1,000 mi).
 * New cars have no price comps, so they search nationwide.
 */
export const LIVE_RADIUS_STEPS = [50, 100] as const;
export const NEARBY_MILES = 50;
/** Deal score bands, as a share of the reference price. */
export const FAIR_BAND = 0.03;
export const HIGH_BAND = 0.08;

export type Tone = 'good' | 'neutral' | 'caution';
export type IntelLine = {
  key:
    | 'deal_score'
    | 'cheaper_nearby'
    | 'miles_vs_similar'
    | 'how_fast'
    | 'left_market'
    | 'time_on_lot'
    | 'value_since_new'
    | 'maker_deals';
  shown: boolean;
  title: string;
  text: string | null;
  detail?: string | null;
  tone?: Tone;
  hiddenReason?: string;
  /** Raw MarketCheck values the text was built from, for audit. */
  source: Record<string, unknown>;
};

export type MarketIntelV1 = {
  version: 'v1';
  condition: 'used' | 'new';
  listingId: string;
  vin: string;
  title: string;
  askingPrice: number;
  fairPrice: number | null;
  similar: {
    count: number;
    searchedMiles: number | null;
    rule: string;
    low: number | null;
    median: number | null;
    high: number | null;
    fairInsideRange: boolean | null;
    /** True only when every car in the range was limited by this car's miles. */
    mileMatched: boolean;
  } | null;
  lines: IntelLine[];
};

type Raw = Record<string, unknown>;

export type Subject = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  condition: 'used' | 'new';
  price: number;
  miles: number | null;
  domActive: number | null;
  dosActive: number | null;
  refPrice: number | null;
  refPriceDate: string | null;
  dealerName: string | null;
  dealerType: 'franchise' | 'independent' | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Everything the card is built from. Each field is the raw MarketCheck payload or null. */
export type IntelInputs = {
  subject: Subject;
  fairPrice: { price: number; msrp: number | null; comparables: FairPriceComp[] } | null;
  /** Used cars: live search of same year/make/model/trim, close miles, widened by radius. */
  usedComps: Raw | null;
  usedCompsRadius: number | null;
  newComps: Raw | null;
  newCompsRadius: number | null;
  cheaper: Raw | null;
  /** Radius actually sent for the cheaper-nearby search. Null when that search did not run. */
  cheaperRadius: number | null;
  history: unknown;
  mds: Raw | null;
  recents: Raw | null;
  recentsRadius: number | null;
  neovin: Raw | null;
  incentives: Raw | null;
  today: Date;
};

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
/** Numbers MarketCheck sometimes sends as strings (dealer latitude, longitude). */
function numLike(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return num(value);
}
function pos(value: unknown): number | null {
  const n = num(value);
  return n != null && n > 0 ? Math.round(n) : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function obj(value: unknown): Raw | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null;
}
function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}
export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
function commas(value: number): string {
  return Math.round(value).toLocaleString('en-US');
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
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return percentile([...values].sort((a, b) => a - b), 0.5);
}
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
/** Price stats from a search, without this car. Exact when every match came back. */
export function searchPrices(raw: Raw | null, vin: string): {
  count: number; low: number | null; median: number | null; high: number | null;
  p10: number | null; p90: number | null; exact: boolean; days: number | null;
} {
  const found = pos(raw?.num_found) ?? 0;
  const rows = (Array.isArray(raw?.listings) ? raw!.listings as unknown[] : []).map(obj).filter((r): r is Raw => r != null);
  const others = rows.filter((r) => str(r.vin)?.toUpperCase() !== vin);
  const days = median(others.map((r) => num(r.dom_active)).filter((d): d is number => d != null));
  if (rows.length > 0 && rows.length >= found) {
    const prices = others.map((r) => pos(r.price)).filter((p): p is number => p != null).sort((a, b) => a - b);
    if (prices.length === 0) return { count: 0, low: null, median: null, high: null, p10: null, p90: null, exact: true, days };
    return {
      count: prices.length,
      low: percentile(prices, 0.25),
      median: percentile(prices, 0.5),
      high: percentile(prices, 0.75),
      p10: percentile(prices, 0.1),
      p90: percentile(prices, 0.9),
      exact: true,
      days,
    };
  }
  const st = statsPrice(raw);
  const pct = obj(obj(obj(raw?.stats)?.price)?.percentiles);
  // Not every match came back, so this count and these stats may include this car.
  return { ...st, count: found, p10: pos(pct?.['10.0']), p90: pos(pct?.['90.0']), exact: false, days };
}
export function subjectFromListing(raw: Raw): Subject | null {
  const build = obj(raw.build) ?? {};
  const dealer = obj(raw.dealer) ?? {};
  const id = str(raw.id);
  const vin = str(raw.vin)?.toUpperCase() ?? null;
  const year = pos(build.year);
  const make = str(build.make);
  const model = str(build.model);
  const price = pos(raw.price);
  if (!id || !vin || !year || !make || !model || !price) return null;
  const inventory = str(raw.inventory_type)?.toLowerCase();
  const dealerType = str(dealer.dealer_type)?.toLowerCase();
  const zip = str(dealer.zip)?.match(/^(\d{5})/)?.[1] ?? null;
  return {
    id,
    vin,
    year,
    make,
    model,
    trim: str(build.trim),
    condition: inventory === 'new' ? 'new' : 'used',
    price,
    miles: num(raw.miles) != null && (raw.miles as number) >= 0 ? Math.round(raw.miles as number) : null,
    domActive: num(raw.dom_active),
    dosActive: num(raw.dos_active),
    refPrice: pos(raw.ref_price),
    refPriceDate: str(raw.ref_price_dt),
    dealerName: str(dealer.name),
    dealerType: dealerType === 'franchise' || dealerType === 'independent' ? dealerType : null,
    zip,
    latitude: numLike(dealer.latitude) ?? numLike(obj(raw.car_location)?.latitude),
    longitude: numLike(dealer.longitude) ?? numLike(obj(raw.car_location)?.longitude),
  };
}

// ---------------------------------------------------------------------------
// Similar cars (used): by likeness first, distance only to widen
// ---------------------------------------------------------------------------

export function pickSimilar(subject: Subject, comps: FairPriceComp[]): {
  picked: FairPriceComp[];
  sameYearTrim: FairPriceComp[];
  searchedMiles: number | null;
  rule: string;
} {
  const others = comps.filter((comp) => comp.price > 0
    && comp.id !== subject.id
    && !(comp.vin && comp.vin.toUpperCase() === subject.vin));
  const yearKnown = others.some((comp) => comp.year != null);
  const trimKnown = Boolean(subject.trim) && others.some((comp) => comp.trim != null);
  const sameYearTrim = others.filter((comp) => (!yearKnown || comp.year === subject.year)
    && (!trimKnown || same(comp.trim, subject.trim)));
  const likeness = `${yearKnown ? 'same year' : 'year not given'}, ${trimKnown ? 'same trim' : 'trim not given'}`;

  for (const window of MILES_WINDOWS) {
    const close = subject.miles == null
      ? sameYearTrim
      : sameYearTrim.filter((comp) => comp.miles != null
        && Math.abs(comp.miles - subject.miles!) <= subject.miles! * window);
    const sorted = [...close].sort((a, b) => (a.distanceMiles ?? 1e9) - (b.distanceMiles ?? 1e9));
    for (const radius of RADIUS_STEPS) {
      const inside = sorted.filter((comp) => radius === Infinity || (comp.distanceMiles ?? 1e9) <= radius);
      if (inside.length >= MIN_SIMILAR) {
        return {
          picked: inside,
          sameYearTrim,
          searchedMiles: radius === Infinity ? null : radius,
          rule: `${likeness}, miles within ${Math.round(window * 100)}%`,
        };
      }
    }
  }
  const lastWindow = MILES_WINDOWS[MILES_WINDOWS.length - 1];
  const fallback = subject.miles == null
    ? sameYearTrim
    : sameYearTrim.filter((comp) => comp.miles != null
      && Math.abs(comp.miles - subject.miles!) <= subject.miles! * lastWindow);
  return {
    picked: fallback,
    sameYearTrim,
    searchedMiles: null,
    rule: `${likeness}, miles within ${Math.round(lastWindow * 100)}% (fewer than ${MIN_SIMILAR} found)`,
  };
}

/**
 * Shopper badge. Cutoffs stay FAIR_BAND / HIGH_BAND from the patch.
 * Used cars compare the asking price only to MarketCheck's fair price.
 * New cars use those same cutoffs. The new-car words are TBD with Design;
 * the strings below are the shopper copy for now. New cars never say fair,
 * fair price, or deal value.
 */
function dealScore(
  asking: number,
  reference: number,
  condition: 'used' | 'new',
): { label: string; tone: Tone; diff: number } {
  const diff = asking - reference;
  const share = diff / reference;
  if (condition === 'new') {
    if (share <= -FAIR_BAND) return { label: `Great: ${money(-diff)} under the typical asking price`, tone: 'good', diff };
    if (share < FAIR_BAND) return { label: 'About typical: close to the typical asking price', tone: 'neutral', diff };
    if (share <= HIGH_BAND) return { label: `A bit high: ${money(diff)} over the typical asking price`, tone: 'caution', diff };
    return { label: `High: ${money(diff)} over the typical asking price`, tone: 'caution', diff };
  }
  if (share <= -FAIR_BAND) return { label: `Great: ${money(-diff)} under the fair price`, tone: 'good', diff };
  if (share < FAIR_BAND) {
    if (diff === 0) return { label: 'Fair: right at the fair price', tone: 'neutral', diff };
    return { label: 'Fair: about the same as the fair price', tone: 'neutral', diff };
  }
  if (share <= HIGH_BAND) return { label: `A bit high: ${money(diff)} over the fair price`, tone: 'caution', diff };
  return { label: `High: ${money(diff)} over the fair price`, tone: 'caution', diff };
}

function mileWindow(subjectMiles: number): number {
  return subjectMiles * MILES_WINDOWS[MILES_WINDOWS.length - 1];
}

/** A range is mile-matched only when this car has miles and every car in it is inside the miles window. */
function rangeIsMileMatched(subject: Subject, useLive: boolean, picked: FairPriceComp[]): boolean {
  if (subject.miles == null) return false;
  if (useLive) return true;
  if (picked.length === 0) return false;
  const window = mileWindow(subject.miles);
  return picked.every((comp) => comp.miles != null && Math.abs(comp.miles - subject.miles!) <= window);
}

// ---------------------------------------------------------------------------
// Price drops at this dealer, since this listing started
// ---------------------------------------------------------------------------

type HistoryPoint = { price: number; seller: string | null; firstSeen: number; lastSeen: number };

function historyPoints(raw: unknown): HistoryPoint[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(obj(raw)?.items) ? (obj(raw)!.items as unknown[])
    : Array.isArray(obj(obj(raw)?.data)?.price_history) ? (obj(obj(raw)!.data)!.price_history as unknown[])
    : Array.isArray(obj(raw)?.data) ? (obj(raw)!.data as unknown[])
    : [];
  const points: HistoryPoint[] = [];
  for (const entry of list) {
    const record = obj(entry);
    if (!record) continue;
    const price = pos(record.price);
    const firstSeen = num(record.first_seen_at) != null
      ? (record.first_seen_at as number) * 1000
      : Date.parse(str(record.first_seen_at_date) ?? '');
    const lastSeen = num(record.last_seen_at) != null
      ? (record.last_seen_at as number) * 1000
      : Date.parse(str(record.last_seen_at_date) ?? '');
    if (price == null || Number.isNaN(firstSeen)) continue;
    points.push({
      price,
      seller: str(record.seller_name),
      firstSeen,
      lastSeen: Number.isNaN(lastSeen) ? firstSeen : lastSeen,
    });
  }
  return points.sort((a, b) => a.firstSeen - b.firstSeen);
}

export type DealerPriceTrail = {
  drops: number | null;
  raises: number;
  totalDrop: number;
  firstPrice: number | null;
  /** First date MarketCheck history covers at this dealer (ISO day), or null. */
  coveredSince: string | null;
  /** True when history starts well after the dealer listing began. */
  partial: boolean;
  points: number;
};

export function dropsAtThisDealer(subject: Subject, history: unknown, today: Date): DealerPriceTrail {
  const none: DealerPriceTrail = { drops: null, raises: 0, totalDrop: 0, firstPrice: null, coveredSince: null, partial: false, points: 0 };
  if (!subject.dealerName || subject.dosActive == null) return none;
  const start = today.getTime() - (subject.dosActive + 1) * 86_400_000;
  const mine = historyPoints(history)
    .filter((point) => same(point.seller, subject.dealerName) && point.lastSeen >= start);
  const prices = mine.map((point) => point.price);
  // The live listing is the latest point at this dealer.
  if (prices.length === 0 || prices[prices.length - 1] !== subject.price) prices.push(subject.price);
  // MarketCheck's own reference price on the listing, when it is from this run.
  const refTime = subject.refPriceDate ? Date.parse(subject.refPriceDate) : NaN;
  if (subject.refPrice && subject.refPrice > subject.price && !Number.isNaN(refTime) && refTime >= start
    && !prices.includes(subject.refPrice)) {
    prices.splice(prices.length - 1, 0, subject.refPrice);
  }
  let drops = 0;
  let raises = 0;
  let totalDrop = 0;
  for (let i = 1; i < prices.length; i += 1) {
    if (prices[i] < prices[i - 1]) {
      drops += 1;
      totalDrop += prices[i - 1] - prices[i];
    } else if (prices[i] > prices[i - 1]) {
      raises += 1;
    }
  }
  const covered = mine.length ? mine[0].firstSeen : null;
  return {
    drops,
    raises,
    totalDrop,
    firstPrice: prices[0] ?? null,
    coveredSince: covered != null ? new Date(covered).toISOString().slice(0, 10) : null,
    partial: covered == null || covered > start + 7 * 86_400_000,
    points: mine.length,
  };
}

// ---------------------------------------------------------------------------
// Build the card
// ---------------------------------------------------------------------------

function hidden(key: IntelLine['key'], title: string, hiddenReason: string, source: Record<string, unknown> = {}): IntelLine {
  return { key, title, shown: false, text: null, hiddenReason, source };
}

function statsPrice(raw: Raw | null): { count: number; low: number | null; median: number | null; high: number | null } {
  const stats = obj(obj(raw?.stats)?.price);
  const pct = obj(stats?.percentiles);
  return {
    count: pos(raw?.num_found) ?? 0,
    low: pos(pct?.['25.0']),
    median: pos(stats?.median) ?? pos(pct?.['50.0']),
    high: pos(pct?.['75.0']),
  };
}

export function buildMarketIntelV1(input: IntelInputs): MarketIntelV1 {
  const s = input.subject;
  const lines: IntelLine[] = [];
  const title = `${s.year} ${s.make} ${s.model}${s.trim ? ` ${s.trim}` : ''}`;
  let similar: MarketIntelV1['similar'] = null;
  let similarDays: number | null = null;

  // 1. Deal score + the range it is judged against.
  if (s.condition === 'used') {
    const fair = input.fairPrice;
    if (!fair) {
      lines.push(hidden('deal_score', 'Deal score', 'MarketCheck returned no fair price for this car.'));
    } else {
      const pick = pickSimilar(s, fair.comparables);
      // Prefer a live search of cars like this one (same year, model, trim,
      // close miles), widened by distance. Fall back to MarketCheck's price comps.
      const live = input.usedComps ? searchPrices(input.usedComps, s.vin) : null;
      const useLive = live != null && live.count >= MIN_SIMILAR && live.median != null;
      const count = useLive ? live!.count : pick.picked.length;
      const searchedMiles = useLive ? input.usedCompsRadius : pick.searchedMiles;
      const rule = useLive
        ? `live search: same year, model, trim; miles within ${Math.round(MILES_WINDOWS[0] * 100)}%`
        : `price comps: ${pick.rule}`;
      const prices = pick.picked.map((comp) => comp.price).sort((a, b) => a - b);
      const q = useLive
        ? { p10: live!.p10, p25: live!.low, p50: live!.median, p75: live!.high, p90: live!.p90 }
        : prices.length >= MIN_SHOW
          ? { p10: percentile(prices, 0.1), p25: percentile(prices, 0.25), p50: percentile(prices, 0.5), p75: percentile(prices, 0.75), p90: percentile(prices, 0.9) }
          : { p10: null, p25: null, p50: null, p75: null, p90: null };
      // Range = middle half of similar cars. If MarketCheck's fair price falls
      // outside it, widen to the middle 80%. If it is still outside, hide the
      // range so the card never shows a fair price that contradicts it.
      let band: 'middle_50' | 'middle_80' | 'hidden' = 'middle_50';
      let low = q.p25;
      let high = q.p75;
      if (low != null && high != null && (fair.price < low || fair.price > high)) {
        band = 'middle_80';
        low = q.p10;
        high = q.p90;
        if (low == null || high == null || fair.price < low || fair.price > high) {
          band = 'hidden';
          low = null;
          high = null;
        }
      }
      const mileMatched = rangeIsMileMatched(s, useLive, pick.picked);
      if (!mileMatched) {
        band = 'hidden';
        low = null;
        high = null;
      }
      const mid = q.p50;
      similar = {
        count,
        searchedMiles,
        rule,
        low,
        median: mid,
        high,
        fairInsideRange: low != null && high != null ? true : band === 'hidden' && q.p25 != null ? false : null,
        mileMatched,
      };
      similarDays = useLive && live!.days != null
        ? live!.days
        : median(pick.picked
          .map((comp) => comp.daysOnMarket)
          .filter((days): days is number => days != null));
      const score = dealScore(s.price, fair.price, 'used');
      const rangeLine = low != null && high != null
        ? ` Most cars like this: ${money(low)} to ${money(high)}.`
        : '';
      lines.push({
        key: 'deal_score',
        title: 'Deal score',
        shown: true,
        text: score.label,
        tone: score.tone,
        detail: `Fair price ${money(fair.price)}.${rangeLine}`,
        source: {
          fairPrice: fair.price,
          askingPrice: s.price,
          comparablesReturned: fair.comparables.length,
          similarCount: count,
          similarRule: rule,
          searchedMiles,
          liveSearchExact: useLive ? live!.exact : null,
          mileMatched,
          rangeBand: band,
          rangeLow: low,
          rangeMedian: mid,
          rangeHigh: high,
          ...q,
        },
      });

      // 3. Miles vs similar (same year and trim, any miles, any distance).
      const miles = pick.sameYearTrim.map((comp) => comp.miles).filter((m): m is number => m != null);
      const typical = median(miles);
      if (s.miles == null || typical == null || miles.length < 5) {
        lines.push(hidden('miles_vs_similar', 'Miles', 'Not enough same-year, same-trim cars with miles.', { count: miles.length }));
      } else {
        const share = (s.miles - typical) / typical;
        const label = share > 0.15 ? 'More than most' : share < -0.15 ? 'Fewer than most' : 'About the same';
        lines.push({
          key: 'miles_vs_similar',
          title: 'Miles',
          shown: true,
          text: `${label}: ${commas(s.miles)} vs about ${commas(typical)}`,
          tone: share > 0.15 ? 'caution' : share < -0.15 ? 'good' : 'neutral',
          source: { subjectMiles: s.miles, medianMiles: typical, count: miles.length },
        });
      }
    }
  } else {
    const st = searchPrices(input.newComps, s.vin);
    if (st.count < MIN_SHOW || st.median == null) {
      lines.push(hidden('deal_score', 'Deal score', 'Too few matching new cars to compare.', { count: st.count }));
    } else {
      similar = {
        count: st.count,
        searchedMiles: input.newCompsRadius,
        rule: 'same year, same trim, new',
        // New cars are not mile-matched, so the range stays hidden.
        low: null,
        median: st.median,
        high: null,
        fairInsideRange: null,
        mileMatched: false,
      };
      similarDays = st.days;
      const score = dealScore(s.price, st.median, 'new');
      lines.push({
        key: 'deal_score',
        title: 'Typical asking price',
        shown: true,
        text: score.label,
        tone: score.tone,
        detail: `Typical asking price ${money(st.median)}.`,
        source: {
          askingPrice: s.price,
          fairPrice: st.median,
          ...st,
          mileMatched: false,
          rangeLow: null,
          rangeHigh: null,
          searchedMiles: input.newCompsRadius,
        },
      });
    }
    lines.push(hidden('miles_vs_similar', 'Miles', 'New car.'));
  }

  // 2. Same car cheaper nearby. The radius is the one this search actually used.
  const cheaperRadius = input.cheaperRadius != null && input.cheaperRadius > 0
    ? Math.round(input.cheaperRadius)
    : null;
  if (!input.cheaper || cheaperRadius == null) {
    lines.push(hidden('cheaper_nearby', 'Cheaper nearby', 'Search did not run or returned no radius.'));
  } else {
    const list = (Array.isArray(input.cheaper.listings) ? input.cheaper.listings : [])
      .map(obj)
      .filter((row): row is Raw => row != null && str(row.vin)?.toUpperCase() !== s.vin && (pos(row.price) ?? 0) > 0
        && (pos(row.price) ?? 0) < s.price);
    const count = list.length === 0 ? 0 : Math.max(pos(input.cheaper.num_found) ?? 0, list.length);
    const cheapest = list[0];
    const rows = list.map((row) => {
      const build = obj(row.build) ?? {};
      return {
        year: pos(build.year),
        make: str(build.make) ?? s.make,
        model: str(build.model) ?? s.model,
        trim: str(build.trim),
        price: pos(row.price),
        miles: pos(row.miles),
        distance: num(row.dist),
      };
    });
    const from = cheapest ? pos(cheapest.price) : null;
    const text = count === 0 || from == null
      ? `None cheaper within ${cheaperRadius} miles.`
      : count === 1
        ? `1 like this within ${cheaperRadius} miles, at ${money(from)}`
        : `${count} like this within ${cheaperRadius} miles, from ${money(from)}`;
    lines.push({
      key: 'cheaper_nearby',
      title: 'Cheaper nearby',
      shown: true,
      text,
      tone: count === 0 ? 'good' : 'caution',
      detail: rows.length
        ? rows.map((row) => {
          const name = [row.year, row.make, row.model, row.trim].filter(Boolean).join(' ');
          const milesBit = row.miles != null ? `${commas(row.miles)} mi` : null;
          const away = row.distance != null ? `${Math.round(row.distance)} mi away` : null;
          return [name, milesBit, away, row.price != null ? money(row.price) : null].filter(Boolean).join(' · ');
        }).join('; ')
        : null,
      source: { numFound: input.cheaper.num_found, radius: cheaperRadius, rows },
    });
  }

  // 4. How fast these sell. Cutoffs stay 30 and 60. Shopper copy never says "days of supply".
  const mds = num(input.mds?.mds);
  const active = num(input.mds?.total_active_cars_for_ymmt);
  const left45 = num(input.mds?.total_cars_sold_in_last_45_days);
  if (mds == null || mds <= 0 || !active) {
    lines.push(hidden('how_fast', 'How fast they sell', 'MarketCheck returned no sell-speed number for this car near here.', { mds, active, left45 }));
  } else {
    const days = Math.round(mds);
    const text = mds <= 30
      ? `Fast: about ${days} days. They go quickly.`
      : mds <= 60
        ? `About ${days} days to sell.`
        : `Slow: about ${days} days. You have time.`;
    lines.push({
      key: 'how_fast',
      title: 'How fast they sell',
      shown: true,
      text,
      tone: mds <= 30 ? 'caution' : mds <= 60 ? 'neutral' : 'good',
      source: { mds, totalActive: active, leftMarket45Days: left45 },
    });
  }

  // 5. Similar cars that left the market (last 90 days). Last asking price, never a sale price.
  // Fewer than MIN_SHOW still hides, matching the patch cutoff.
  const rec = input.recents ? statsPrice(input.recents) : { count: 0, low: null, median: null, high: null };
  if (!input.recents || rec.count < MIN_SHOW) {
    lines.push(hidden('left_market', 'Left the market', 'Fewer than 3 similar cars left the market nearby in 90 days.', { count: rec.count }));
  } else {
    const dollars = rec.median != null ? ` Last asking prices were about ${money(rec.median)}.` : '';
    lines.push({
      key: 'left_market',
      title: 'Left the market',
      shown: true,
      text: `${rec.count} similar cars left the market in the last 90 days.${dollars} These are not final sale prices.`,
      tone: 'neutral',
      source: { count: rec.count, median: rec.median, p25: rec.low, p75: rec.high, searchedMiles: input.recentsRadius },
    });
  }

  // 6. Days and price cuts for this listing at this dealer only.
  // dosActive is the current run here. A total-market day count is not this listing.
  const drops = dropsAtThisDealer(s, input.history, input.today);
  if (s.dosActive == null) {
    lines.push(hidden('time_on_lot', 'This dealer', 'MarketCheck returned no days at this dealer for this listing.'));
  } else {
    const days = Math.max(0, Math.round(s.dosActive));
    const dayWord = days === 1 ? 'day' : 'days';
    let text = `Listed ${days} ${dayWord} ago.`;
    if (drops.drops === 0) {
      text = `Listed ${days} ${dayWord} ago. No price cuts yet.`;
    } else if (drops.drops != null && drops.drops > 0) {
      const cut = drops.drops === 1 ? 'Price cut 1 time.' : `Price cut ${drops.drops} times.`;
      const net = (drops.firstPrice ?? s.price) - s.price;
      const below = net > 0 ? ` Now ${money(net)} below the first price.` : '';
      text = `On the lot ${days} ${dayWord}. ${cut}${below}`;
    }
    lines.push({
      key: 'time_on_lot',
      title: 'This dealer',
      shown: true,
      text,
      tone: days >= 60 || (drops.drops ?? 0) > 0 ? 'good' : 'neutral',
      source: {
        dosActive: s.dosActive,
        domActive: s.domActive,
        drops: drops.drops,
        raises: drops.raises,
        sumOfCuts: drops.totalDrop,
        firstPriceHere: drops.firstPrice,
        historyCoversSince: drops.coveredSince,
        historyPartial: drops.partial,
        historyPointsAtThisDealer: drops.points,
        refPrice: s.refPrice,
        similarMedianDays: similarDays,
      },
    });
  }

  // 7. Value since new (used) or price vs factory sticker (new).
  const sticker = s.condition === 'used'
    ? input.fairPrice?.msrp ?? null
    : pos(input.neovin?.combined_msrp) ?? pos(input.neovin?.msrp);
  if (sticker == null) {
    lines.push(hidden('value_since_new', s.condition === 'used' ? 'When it was new' : 'Price vs sticker', 'MarketCheck returned no factory sticker for this VIN.'));
  } else if (s.condition === 'used') {
    lines.push({
      key: 'value_since_new',
      title: 'When it was new',
      shown: true,
      text: `It cost about ${money(sticker)} new. They ask ${money(s.price)} now.`,
      tone: 'neutral',
      source: { factorySticker: sticker, from: 'predict_price_with_comparables.msrp', askingPrice: s.price },
    });
  } else {
    const diff = sticker - s.price;
    lines.push({
      key: 'value_since_new',
      title: 'Price vs sticker',
      shown: true,
      text: diff > 0 ? `${money(diff)} under the sticker of ${money(sticker)}`
        : diff < 0 ? `${money(-diff)} over the sticker of ${money(sticker)}`
        : `At the sticker price of ${money(sticker)}`,
      tone: diff > 0 ? 'good' : diff < 0 ? 'caution' : 'neutral',
      source: { factorySticker: sticker, from: 'neovin.combined_msrp', askingPrice: s.price },
    });
  }

  // 8. Real maker deals (new cars only).
  if (s.condition !== 'new') {
    lines.push(hidden('maker_deals', 'Maker deals', 'Used car.'));
  } else {
    const offers = readOffers(input.incentives, s, input.today);
    if (offers.length === 0) {
      lines.push(hidden('maker_deals', 'Maker deals', 'MarketCheck returned no current offers for this model near this ZIP.'));
    } else {
      lines.push({
        key: 'maker_deals',
        title: 'Maker deals',
        shown: true,
        text: `${s.make} deals near you`,
        tone: 'good',
        detail: offers.slice(0, 3).map((offer) => offer.text).join('; '),
        source: { offers },
      });
    }
  }

  return {
    version: 'v1',
    condition: s.condition,
    listingId: s.id,
    vin: s.vin,
    title,
    askingPrice: s.price,
    fairPrice: s.condition === 'used' ? input.fairPrice?.price ?? null : null,
    similar,
    lines,
  };
}

function readOffers(raw: Raw | null, s: Subject, today: Date): { text: string; validThrough: string; type: string }[] {
  const data = obj(raw?.data) ?? raw;
  const listings = Array.isArray(data?.listings) ? data!.listings as unknown[] : [];
  const out: { text: string; validThrough: string; type: string }[] = [];
  for (const entry of listings) {
    const offer = obj(obj(entry)?.offer);
    if (!offer) continue;
    const vehicles = Array.isArray(offer.vehicles) ? offer.vehicles.map(obj).filter((v): v is Raw => v != null) : [];
    const match = vehicles.some((v) => same(str(v.model), s.model)
      && (pos(v.year) == null || pos(v.year) === s.year));
    if (!match) continue;
    const through = str(offer.valid_through);
    const end = through ? Date.parse(through) : NaN;
    if (!through || Number.isNaN(end) || end < today.getTime() - 86_400_000) continue;
    const type = str(offer.offer_type) ?? 'offer';
    const amount = obj(Array.isArray(offer.amounts) ? offer.amounts[0] : null);
    const cash = pos(offer.cashback_amount);
    const bits: string[] = [];
    if (type === 'lease' && pos(amount?.monthly)) bits.push(`Lease ${money(pos(amount!.monthly)!)} a month for ${pos(amount!.term)} months, ${money(pos(offer.due_at_signing) ?? 0)} due at signing`);
    else if (type === 'finance' && num(amount?.apr) != null) bits.push(`${num(amount!.apr)}% APR for ${pos(amount!.term)} months`);
    if (cash) bits.push(`${money(cash)} cash back`);
    const name = str(Array.isArray(offer.titles) ? offer.titles[0] : null)
      ?? (type === 'lease' ? 'Lease' : type === 'finance' ? 'Finance' : 'Offer');
    const terms = bits.filter((bit) => bit !== name);
    const endLabel = shortDate(through);
    const text = terms.length
      ? `${name}: ${terms.join(', ')}. Ends ${endLabel}.`
      : `${name}. Ends ${endLabel}.`;
    out.push({ text, validThrough: through, type });
  }
  return out;
}

/**
 * Cars like this one for sale now: same year, make, model, trim and condition,
 * close miles for used. Widens 50 then 100 miles (plan limit), then nationwide
 * for new cars, until at least MIN_SIMILAR other cars match. Returns the
 * radius it stopped at (null = nationwide).
 */
export async function searchSimilarActive(
  subject: Subject,
  near: Record<string, string | number | undefined>,
  milesRange: string | undefined,
  get: typeof marketCheckGet = marketCheckGet,
): Promise<{ raw: Raw | null; radius: number | null }> {
  let raw: Raw | null = null;
  const steps: number[] = subject.condition === 'new' ? [...LIVE_RADIUS_STEPS, Infinity] : [...LIVE_RADIUS_STEPS];
  for (const radius of steps) {
    raw = await get('search/car/active', {
      year: subject.year,
      make: subject.make,
      model: subject.model,
      trim: subject.trim ?? undefined,
      car_type: subject.condition,
      miles_range: milesRange,
      ...(radius === Infinity ? {} : { ...near, radius }),
      rows: 50,
      stats: 'price',
    }, 'search_active');
    const found = pos(raw?.num_found) ?? 0;
    // num_found includes this car when it is in range.
    if (found - 1 >= MIN_SIMILAR) return { raw, radius: radius === Infinity ? null : radius };
  }
  // Used: not enough nearby; caller falls back to the price comps.
  return { raw, radius: subject.condition === 'new' ? null : steps[steps.length - 1] };
}

/** Every MarketCheck read on one unlock: listing, price, search, history, MDS, recents, NeoVIN. */
export const MARKET_INTEL_CALL_BUDGET = 12;
/** A retry inside this window reuses the card or the empty quote. It does not pay again. */
export const MARKET_INTEL_PARTIAL_MS = 10 * 60 * 1000;

export type MarketIntelV1Result = {
  card: MarketIntelV1 | null;
  /** MarketCheck finished and there is no fair price or typical asking price. */
  definitiveEmpty: boolean;
  /** 402, 429, or a timeout. Do not remember this as an empty quote. */
  upstreamRetry: boolean;
};

type UnlockPartial = {
  expiresAt: number;
  result?: MarketIntelV1Result;
  subject?: Subject;
  fairPrice?: IntelInputs['fairPrice'] | null;
  fairKnown?: boolean;
};

const unlockPartials = new Map<string, UnlockPartial>();

export function resetMarketIntelUnlockCacheForTests(): void {
  unlockPartials.clear();
}

function upstreamRetryError(error: unknown): boolean {
  if (error instanceof McpQuotaError || error instanceof McpRateLimitError) return true;
  if (!(error instanceof MarketCheckUpstreamError)) return false;
  if (error.status === 402 || error.status === 429 || error.kind === 'timeout') return true;
  return /timed out|timeout/i.test(error.message);
}

type PriceLoader = typeof loadFairPriceIfAllowed;

function budgetedGet(budget: { left: number }, get: typeof marketCheckGet): typeof marketCheckGet {
  return async (path, params, endpoint, timeout) => {
    if (budget.left <= 0) return null;
    budget.left -= 1;
    return get(path, params, endpoint, timeout);
  };
}

// ---------------------------------------------------------------------------
// Loader: one unlock. Calls MarketCheck only; writes nothing.
// ---------------------------------------------------------------------------

export async function loadMarketIntelV1(input: {
  listingId: string;
  userId?: string | null;
  /** Shopper's ZIP. Maker offers are regional, so they use this first. */
  profileZip?: string | null;
  today?: Date;
  nowMs?: number;
  /** Tests only. Shopper calls use marketCheckGet. */
  get?: typeof marketCheckGet;
  /** Tests only. Shopper calls use loadFairPriceIfAllowed. */
  loadPrice?: PriceLoader;
}): Promise<MarketIntelV1Result> {
  const now = input.nowMs ?? Date.now();
  const cached = unlockPartials.get(input.listingId);
  if (cached && cached.expiresAt > now && cached.result) return cached.result;
  if (!fairPriceSpendEnabled()) {
    return { card: null, definitiveEmpty: false, upstreamRetry: false };
  }

  const budget = { left: MARKET_INTEL_CALL_BUDGET };
  const get = budgetedGet(budget, input.get ?? marketCheckGet);
  const loadPrice = input.loadPrice ?? loadFairPriceIfAllowed;
  const today = input.today ?? new Date(now);
  const empty = (definitiveEmpty: boolean): MarketIntelV1Result => {
    const result = { card: null, definitiveEmpty, upstreamRetry: false };
    if (definitiveEmpty) {
      unlockPartials.set(input.listingId, { expiresAt: now + MARKET_INTEL_PARTIAL_MS, result });
    }
    return result;
  };

  try {
    let subject = cached && cached.expiresAt > now ? cached.subject ?? null : null;
    if (!subject) {
      const listing = await get(`listing/car/${encodeURIComponent(input.listingId)}`, {}, 'listing_detail');
      subject = listing ? subjectFromListing(listing) : null;
    }
    if (!subject) return empty(true);

    const near = subject.latitude != null && subject.longitude != null
      ? { latitude: subject.latitude, longitude: subject.longitude }
      : { zip: subject.zip ?? undefined };
    const milesRange = subject.condition === 'used' && subject.miles != null
      ? `${Math.max(0, Math.round(subject.miles * (1 - MILES_WINDOWS[0])))}-${Math.round(subject.miles * (1 + MILES_WINDOWS[0]))}`
      : undefined;
    const ymmt = {
      year: subject.year,
      make: subject.make,
      model: subject.model,
      trim: subject.trim ?? undefined,
      car_type: subject.condition,
    };

    let fairPrice: IntelInputs['fairPrice'] = cached?.fairKnown ? cached.fairPrice ?? null : null;
    let usedComps: Raw | null = null;
    let usedCompsRadius: number | null = null;
    let newComps: Raw | null = null;
    let newCompsRadius: number | null = null;
    let neovin: Raw | null = null;
    let incentives: Raw | null = null;
    const fairKnown = cached?.fairKnown === true;

    if (subject.condition === 'used') {
      if (!fairKnown) {
        if (!(subject.zip && subject.miles != null) || budget.left <= 0) {
          unlockPartials.set(input.listingId, {
            expiresAt: now + MARKET_INTEL_PARTIAL_MS,
            subject,
            fairPrice: null,
            fairKnown: false,
          });
          if (!(subject.zip && subject.miles != null)) return empty(true);
          return { card: null, definitiveEmpty: false, upstreamRetry: false };
        }
        budget.left -= 1;
        const quote = await loadPrice('unlock_with_agent', {
          vin: subject.vin,
          miles: subject.miles,
          zip: subject.zip,
          condition: 'used',
          dealerType: subject.dealerType,
        }, { strict: true, userId: input.userId, purpose: 'market_intel' });
        if (quote?.fromCache) budget.left += 1;
        if (quote && quote.price > 0) {
          fairPrice = { price: quote.price, msrp: quote.msrp ?? null, comparables: quote.comparables ?? [] };
        }
      }
      if (!fairPrice) return empty(true);
      unlockPartials.set(input.listingId, {
        expiresAt: now + MARKET_INTEL_PARTIAL_MS,
        subject,
        fairPrice,
        fairKnown: true,
      });
      ({ raw: usedComps, radius: usedCompsRadius } = await searchSimilarActive(subject, near, milesRange, get));
    } else {
      ({ raw: newComps, radius: newCompsRadius } = await searchSimilarActive(subject, near, undefined, get));
      const stats = searchPrices(newComps, subject.vin);
      if (stats.count < MIN_SHOW || stats.median == null) return empty(true);
      neovin = await get(`decode/car/neovin/${encodeURIComponent(subject.vin)}/specs`, {}, 'neovin');
      const offerZip = input.profileZip?.match(/^\d{5}/)?.[0] ?? subject.zip;
      if (budget.left > 0) {
        budget.left -= 1;
        try {
          incentives = obj(await callMcpTool<unknown>('search_oem_incentives_by_zip', {
            oem: subject.make.toLowerCase(),
            zip: offerZip ?? undefined,
            model: subject.model,
            year: String(subject.year),
            rows: 10,
          }, 8000, { strict: true }));
        } catch (error) {
          if (upstreamRetryError(error)) throw error;
          console.error(JSON.stringify({ event: 'mi_v1_incentives_failed', error: error instanceof Error ? error.name : 'error' }));
          incentives = null;
        }
      }
    }

    const cheaper = await get('search/car/active', {
      ...ymmt,
      ...near,
      radius: NEARBY_MILES,
      miles_range: milesRange,
      price_range: `1-${subject.price - 1}`,
      sort_by: 'price',
      sort_order: 'asc',
      rows: 3,
    }, 'search_active');
    const history = await get(`history/car/${encodeURIComponent(subject.vin)}`, {}, 'car_history');
    const mds = subject.latitude != null && subject.longitude != null
      ? await get('mds/car', {
        vin: subject.vin,
        latitude: subject.latitude,
        longitude: subject.longitude,
        radius: 100,
        exact: true,
      }, 'mds')
      : null;
    let recents: Raw | null = null;
    let recentsRadius: number | null = null;
    for (const radius of [100, 250] as const) {
      if (budget.left <= 0) break;
      recents = await get('search/car/recents', {
        ...ymmt,
        ...near,
        radius,
        miles_range: milesRange,
        rows: 0,
        stats: 'price',
      }, 'search_recents');
      recentsRadius = radius;
      if ((pos(recents?.num_found) ?? 0) >= MIN_SIMILAR) break;
    }

    const card = buildMarketIntelV1({
      subject,
      fairPrice,
      usedComps,
      usedCompsRadius,
      newComps,
      newCompsRadius,
      cheaper,
      cheaperRadius: cheaper ? NEARBY_MILES : null,
      history,
      mds,
      recents,
      recentsRadius,
      neovin,
      incentives,
      today,
    });
    const shown = card.lines.some((line) => line.key === 'deal_score' && line.shown);
    const result: MarketIntelV1Result = {
      card: shown ? card : null,
      definitiveEmpty: !shown,
      upstreamRetry: false,
    };
    unlockPartials.set(input.listingId, { expiresAt: now + MARKET_INTEL_PARTIAL_MS, result, subject, fairPrice, fairKnown: true });
    return result;
  } catch (error) {
    if (upstreamRetryError(error)) {
      return { card: null, definitiveEmpty: false, upstreamRetry: true };
    }
    throw error;
  }
}

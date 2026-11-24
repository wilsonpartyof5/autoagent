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
import { callMcpTool } from '@/lib/marketcheck/mcp-client';
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
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
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
function radiusText(miles: number | null): string {
  return miles == null ? 'across the US' : `within ${commas(miles)} miles`;
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

function dealScore(asking: number, reference: number, against: string): { label: string; tone: Tone; diff: number } {
  const diff = asking - reference;
  const share = diff / reference;
  if (share <= -FAIR_BAND) return { label: `Good price: ${money(-diff)} under ${against}`, tone: 'good', diff };
  if (share < FAIR_BAND) {
    const side = diff === 0 ? 'right at' : diff < 0 ? `${money(-diff)} under` : `${money(diff)} over`;
    return { label: `Fair price: ${side} ${against}`, tone: 'neutral', diff };
  }
  if (share <= HIGH_BAND) return { label: `A bit high: ${money(diff)} over ${against}`, tone: 'caution', diff };
  return { label: `High: ${money(diff)} over ${against}`, tone: 'caution', diff };
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
      const mid = q.p50;
      similar = {
        count,
        searchedMiles,
        rule,
        low,
        median: mid,
        high,
        fairInsideRange: low != null && high != null ? true : band === 'hidden' && q.p25 != null ? false : null,
      };
      similarDays = useLive && live!.days != null
        ? live!.days
        : median(pick.picked
          .map((comp) => comp.daysOnMarket)
          .filter((days): days is number => days != null));
      const score = dealScore(s.price, fair.price, 'fair price');
      lines.push({
        key: 'deal_score',
        title: 'Deal score',
        shown: true,
        text: score.label,
        tone: score.tone,
        detail: low != null && high != null
          ? `Fair price ${money(fair.price)}. Most similar cars list for ${money(low)} to ${money(high)} (${count} ${plural(count, 'car', 'cars')} like this ${radiusText(searchedMiles)}).`
          : `Fair price ${money(fair.price)}.`,
        source: {
          fairPrice: fair.price,
          askingPrice: s.price,
          comparablesReturned: fair.comparables.length,
          similarCount: count,
          similarRule: rule,
          searchedMiles,
          liveSearchExact: useLive ? live!.exact : null,
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
        const label = share > 0.15 ? 'More miles than most' : share < -0.15 ? 'Fewer miles than most' : 'About normal miles';
        lines.push({
          key: 'miles_vs_similar',
          title: 'Miles',
          shown: true,
          text: `${label}: ${commas(s.miles)} vs about ${commas(typical)} on similar cars`,
          tone: share > 0.15 ? 'caution' : share < -0.15 ? 'good' : 'neutral',
          detail: `Based on ${miles.length} other ${s.year} ${s.model}${s.trim ? ` ${s.trim}` : ''} for sale that MarketCheck used to price this car.`,
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
        low: st.low,
        median: st.median,
        high: st.high,
        fairInsideRange: null,
      };
      similarDays = st.days;
      const score = dealScore(s.price, st.median, 'similar new cars');
      lines.push({
        key: 'deal_score',
        title: 'Deal score',
        shown: true,
        text: score.label,
        tone: score.tone,
        detail: st.low != null && st.high != null
          ? `Most new ones like this list for ${money(st.low)} to ${money(st.high)} (${st.count} cars, ${radiusText(input.newCompsRadius)}).`
          : null,
        source: { askingPrice: s.price, ...st, searchedMiles: input.newCompsRadius },
      });
    }
    lines.push(hidden('miles_vs_similar', 'Miles', 'New car.'));
  }

  // 2. Same car cheaper nearby (real search, within 50 miles).
  if (!input.cheaper) {
    lines.push(hidden('cheaper_nearby', 'Cheaper nearby', 'Search did not run or returned nothing.'));
  } else {
    const list = (Array.isArray(input.cheaper.listings) ? input.cheaper.listings : [])
      .map(obj)
      .filter((row): row is Raw => row != null && str(row.vin)?.toUpperCase() !== s.vin && (pos(row.price) ?? 0) > 0
        && (pos(row.price) ?? 0) < s.price);
    const count = list.length === 0 ? 0 : Math.max(pos(input.cheaper.num_found) ?? 0, list.length);
    const cheapest = list[0];
    const rows = list.slice(0, 3).map((row) => ({
      price: pos(row.price),
      miles: pos(row.miles),
      distance: num(row.dist),
      dealer: str(obj(row.dealer)?.name),
    }));
    lines.push({
      key: 'cheaper_nearby',
      title: 'Cheaper nearby',
      shown: true,
      text: count === 0
        ? `No cheaper ${s.condition === 'new' ? 'new ' : ''}${s.model}${s.trim ? ` ${s.trim}` : ''} like this within ${NEARBY_MILES} miles of this one`
        : `${count} ${plural(count, 'car', 'cars')} like this for less within ${NEARBY_MILES} miles of this one, from ${money(pos(cheapest!.price)!)}`,
      tone: count === 0 ? 'good' : 'caution',
      detail: rows.length
        ? rows.map((row) => `${money(row.price ?? 0)}${row.miles ? `, ${commas(row.miles)} miles` : ''}${row.distance != null ? `, ${Math.round(row.distance)} mi away` : ''}${row.dealer ? ` (${row.dealer})` : ''}`).join('; ')
        : null,
      source: { numFound: input.cheaper.num_found, rows },
    });
  }

  // 4. How fast these sell (market days supply).
  const mds = num(input.mds?.mds);
  const active = num(input.mds?.total_active_cars_for_ymmt);
  const left45 = num(input.mds?.total_cars_sold_in_last_45_days);
  if (mds == null || mds <= 0 || !active) {
    lines.push(hidden('how_fast', 'How fast these sell', 'MarketCheck returned no days-of-supply for this car near here.', { mds, active, left45 }));
  } else {
    const label = mds <= 30 ? 'Sells fast' : mds <= 60 ? 'Normal pace' : 'Slow seller';
    lines.push({
      key: 'how_fast',
      title: 'How fast these sell',
      shown: true,
      text: `${label}: about ${Math.round(mds)} days of supply near you`,
      tone: mds <= 30 ? 'caution' : mds <= 60 ? 'neutral' : 'good',
      detail: `Same exact build within 100 miles: ${active} for sale now, ${left45 ?? 0} left the market in the last 45 days.`,
      source: { mds, totalActive: active, leftMarket45Days: left45 },
    });
  }

  // 5. Similar cars that left the market (last 90 days). Last listed price, not a sold price.
  const rec = statsPrice(input.recents);
  if (rec.count < MIN_SHOW || rec.median == null) {
    lines.push(hidden('left_market', 'Similar cars that left the market', 'Fewer than 3 similar cars left the market nearby in 90 days.', { count: rec.count }));
  } else {
    lines.push({
      key: 'left_market',
      title: 'Similar cars that left the market',
      shown: true,
      text: `${rec.count} similar cars left the market in the last 90 days. Their last asking price was about ${money(rec.median)}.`,
      tone: 'neutral',
      detail: `${radiusText(input.recentsRadius)}. Last listed prices, not final sale prices.`,
      source: { count: rec.count, median: rec.median, p25: rec.low, p75: rec.high, searchedMiles: input.recentsRadius },
    });
  }

  // 6. Time on the lot + price drops at this dealer.
  const drops = dropsAtThisDealer(s, input.history, input.today);
  if (s.dosActive == null && s.domActive == null) {
    lines.push(hidden('time_on_lot', 'Time on the lot', 'MarketCheck returned no days on market for this listing.'));
  } else {
    const days = s.dosActive ?? s.domActive!;
    const parts = [`At this dealer ${days} ${plural(days, 'day', 'days')}.`];
    if (s.domActive != null && s.dosActive != null && s.domActive > s.dosActive + 7) {
      parts.push(`For sale ${s.domActive} days in total.`);
    }
    if (drops.drops != null) {
      const since = drops.partial && drops.coveredSince ? ` since ${shortDate(drops.coveredSince)}` : '';
      if (drops.drops === 0) {
        parts.push(`No price cuts seen here${since}.`);
      } else {
        const net = (drops.firstPrice ?? s.price) - s.price;
        const raised = drops.raises > 0 ? ` and raised ${drops.raises} ${plural(drops.raises, 'time', 'times')}` : '';
        parts.push(`Price cut ${drops.drops} ${plural(drops.drops, 'time', 'times')}${raised} here${since}.`
          + (net > 0 ? ` Now ${money(net)} below its first price here (${money(drops.firstPrice!)}).` : ''));
      }
    }
    lines.push({
      key: 'time_on_lot',
      title: 'Time on the lot',
      shown: true,
      text: parts.join(' '),
      tone: days >= 60 || (drops.drops ?? 0) > 0 ? 'good' : 'neutral',
      detail: similarDays != null ? `Similar cars have been for sale about ${similarDays} days.` : null,
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
    lines.push(hidden('value_since_new', s.condition === 'used' ? 'Value since new' : 'Price vs sticker', 'MarketCheck returned no factory sticker for this VIN.'));
  } else if (s.condition === 'used') {
    if (sticker <= s.price) {
      lines.push(hidden('value_since_new', 'Value since new', 'Sticker is not above the asking price, so the number would mislead.', { sticker }));
    } else {
      const lost = sticker - s.price;
      lines.push({
        key: 'value_since_new',
        title: 'Value since new',
        shown: true,
        text: `Cost about ${money(sticker)} new. This one asks ${money(lost)} less (${Math.round((lost / sticker) * 100)}% less).`,
        tone: 'neutral',
        source: { factorySticker: sticker, from: 'predict_price_with_comparables.msrp', askingPrice: s.price },
      });
    }
  } else {
    const diff = sticker - s.price;
    lines.push({
      key: 'value_since_new',
      title: 'Price vs sticker',
      shown: true,
      text: diff > 0 ? `${money(diff)} below the factory sticker of ${money(sticker)}`
        : diff < 0 ? `${money(-diff)} above the factory sticker of ${money(sticker)}`
        : `Right at the factory sticker of ${money(sticker)}`,
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
        text: `${offers.length} ${plural(offers.length, 'offer', 'offers')} from ${s.make} near you`,
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
    if (bits.length === 0) bits.push(str(Array.isArray(offer.titles) ? offer.titles[0] : null) ?? type);
    out.push({ text: `${bits.join(', ')} (ends ${through})`, validThrough: through, type });
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
): Promise<{ raw: Raw | null; radius: number | null }> {
  let raw: Raw | null = null;
  const steps: number[] = subject.condition === 'new' ? [...LIVE_RADIUS_STEPS, Infinity] : [...LIVE_RADIUS_STEPS];
  for (const radius of steps) {
    raw = await marketCheckGet('search/car/active', {
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

// ---------------------------------------------------------------------------
// Loader: one unlock. Calls MarketCheck only; writes nothing.
// ---------------------------------------------------------------------------

export async function loadMarketIntelV1(input: {
  listingId: string;
  userId?: string | null;
  /** Shopper's ZIP. Maker offers are regional, so they use this first. */
  profileZip?: string | null;
  today?: Date;
}): Promise<MarketIntelV1 | null> {
  if (!fairPriceSpendEnabled()) return null;
  const today = input.today ?? new Date();
  const listing = await marketCheckGet(`listing/car/${encodeURIComponent(input.listingId)}`, {}, 'listing_detail');
  const subject = listing ? subjectFromListing(listing) : null;
  if (!subject) return null;
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

  let fairPrice: IntelInputs['fairPrice'] = null;
  let usedComps: Raw | null = null;
  let usedCompsRadius: number | null = null;
  let newComps: Raw | null = null;
  let newCompsRadius: number | null = null;
  let neovin: Raw | null = null;
  let incentives: Raw | null = null;

  if (subject.condition === 'used') {
    if (subject.zip && subject.miles != null) {
      const quote = await loadFairPriceIfAllowed('unlock_with_agent', {
        vin: subject.vin,
        miles: subject.miles,
        zip: subject.zip,
        condition: 'used',
        dealerType: subject.dealerType,
      }, { strict: true, userId: input.userId, purpose: 'market_intel' });
      if (quote && quote.price > 0) {
        fairPrice = { price: quote.price, msrp: quote.msrp ?? null, comparables: quote.comparables ?? [] };
      }
    }
    if (fairPrice) {
      ({ raw: usedComps, radius: usedCompsRadius } = await searchSimilarActive(subject, near, milesRange));
    }
  } else {
    ({ raw: newComps, radius: newCompsRadius } = await searchSimilarActive(subject, near, undefined));
    neovin = await marketCheckGet(`decode/car/neovin/${encodeURIComponent(subject.vin)}/specs`, {}, 'neovin');
    const offerZip = input.profileZip?.match(/^\d{5}/)?.[0] ?? subject.zip;
    try {
      incentives = obj(await callMcpTool<unknown>('search_oem_incentives_by_zip', {
        oem: subject.make.toLowerCase(),
        zip: offerZip ?? undefined,
        model: subject.model,
        year: String(subject.year),
        rows: 10,
      }, 8000, { strict: true }));
    } catch (error) {
      // No offers is better than a broken card. The line hides.
      console.error(JSON.stringify({ event: 'mi_v1_incentives_failed', error: error instanceof Error ? error.name : 'error' }));
      incentives = null;
    }
  }

  const cheaper = await marketCheckGet('search/car/active', {
    ...ymmt,
    ...near,
    radius: NEARBY_MILES,
    miles_range: milesRange,
    price_range: `1-${subject.price - 1}`,
    sort_by: 'price',
    sort_order: 'asc',
    rows: 3,
  }, 'search_active');
  const history = await marketCheckGet(`history/car/${encodeURIComponent(subject.vin)}`, {}, 'car_history');
  const mds = subject.latitude != null && subject.longitude != null
    ? await marketCheckGet('mds/car', {
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
    recents = await marketCheckGet('search/car/recents', {
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

  return buildMarketIntelV1({
    subject,
    fairPrice,
    usedComps,
    usedCompsRadius,
    newComps,
    newCompsRadius,
    cheaper,
    history,
    mds,
    recents,
    recentsRadius,
    neovin,
    incentives,
    today,
  });
}

/**
 * In-network shopper chips (Deal Brain middleman spec, T1–T13 and T13b).
 * Suggestions only. The shopper taps send. Nothing here is auto-sent.
 * A chip with a missing required field is omitted. T3–T5 use the spec
 * fallback sentence when a market figure is missing. They never invent a price.
 *
 * Spec §4b: flat or mandatory fees are thanked and passed as-is, transport
 * terms are relayed verbatim and never agreed, and a listed price change is
 * relayed plainly (`They say it's now {new_price}`) with no bait-and-switch
 * claim. This module does not auto-send those relays. A come-in push offers
 * the warm stay chip. The admin flag stays in otd-warnings and is not cleared.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { runGuardrails } from '@/lib/brain/guardrails';
import { shopperFirstNameOnly } from '@/lib/dealer/rooftop-match';
import { messageHasItemizedOtd } from '@/lib/dealer/otd-warnings';
import { ShopperDealError, type ShopperDealRepository } from './deals';

export const CHIP_LABEL_LIMIT = 18;
export const CHIP_BODY_LIMIT = 160;

export const CHIP_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T13b', 'STAY'] as const;
export type ChipId = (typeof CHIP_IDS)[number];

export const CHIP_STAGES = ['after_opener', 'after_availability', 'after_price', 'after_itemized_otd'] as const;
export type ChipStage = (typeof CHIP_STAGES)[number];

const STAGE_ORDER: Record<ChipStage, readonly ChipId[]> = {
  after_opener: ['T6', 'T1'],
  after_availability: ['T2', 'T6', 'T3'],
  after_price: ['T6', 'T4', 'T5', 'T7'],
  after_itemized_otd: ['T13', 'T13b', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
};

const LABELS: Record<ChipId, string> = {
  T1: 'Still available?',
  T2: 'Still this price?',
  T3: 'Price vs market',
  T4: 'Similar cars',
  T5: 'Time on market',
  T6: 'Itemized OTD',
  T7: 'Thanks',
  T8: 'Got it, thinking',
  T9: 'Ask about feature',
  T10: 'Your hours?',
  T11: 'Trade-in question',
  T12: 'Plan a visit',
  T13: 'Confirm OTD',
  T13b: 'Confirm lease due',
  STAY: 'Numbers first',
};

export type ChipIntel = {
  stockNumber?: string | null;
  listedPrice?: number | null;
  fairPrice?: number | null;
  compsCount?: number | null;
  compsLowPrice?: number | null;
  dom?: number | null;
  feature?: string | null;
  rep?: string | null;
  visitDay?: string | null;
  visitTime?: string | null;
  itemizedOtdInThread?: boolean | null;
  /** Dealer-stated itemized out-the-door total. Not a sum we invent. */
  otdTotal?: number | null;
  /** Lease deal. T13b stays hidden on a cash or finance thread. */
  lease?: boolean | null;
  dueAtSigning?: number | null;
  /** Shopper first name only. Used by the come-in warm stay chip. */
  shopperFirst?: string | null;
  /** Dealer pushed a visit before the numbers. Not a come-in from our side. */
  comeInPush?: boolean | null;
};

export type ChipSuggestion = {
  id: ChipId;
  templateId: ChipId;
  label: string;
  message: string;
  sendsAutomatically: false;
};

export type ChipSuggestionSet = {
  network: 'in_network';
  stage: ChipStage;
  autoSend: false;
  chips: ChipSuggestion[];
};

export type ThreadMessage = {
  author?: string | null;
  body?: string | null;
};

const HAGGLE = /\b(negotiat\w*|haggl\w*|bargain\w*|lowball\w*|counter-?offers?|come down|do better|best offer)\b/i;
const PHRASE = /^[A-Za-z0-9][A-Za-z0-9 '&./+-]{0,40}$/;

export function isChipStage(value: unknown): value is ChipStage {
  return typeof value === 'string' && (CHIP_STAGES as readonly string[]).includes(value);
}

export function formatChipMoney(amount: number | null | undefined): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(rounded);
}

export function chipCopyAllowed(body: string): boolean {
  if (!body || body.length > CHIP_BODY_LIMIT) return false;
  if (body.includes('{')) return false;
  if (HAGGLE.test(body)) return false;
  const result = runGuardrails({
    action: 'clarify',
    draft: body,
    channel: 'email',
    hasOptedInToText: true,
    hasTextedBefore: true,
    fairOtd: null,
    currentOfferOtd: null,
    pushbackCount: 0,
    shopperFirst: 'Shopper',
    draftPricesTrusted: true,
  });
  return !result.blocked && result.checks.noNegotiateWord && result.checks.noAutomatedAssistant && result.checks.noShopperContactInfo;
}

function repName(raw: string | null | undefined): string | null {
  return shopperFirstNameOnly(raw);
}

function stockNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const stock = raw.trim().replace(/^#/, '').toUpperCase();
  if (!/^[A-Z0-9-]{1,15}$/.test(stock)) return null;
  return stock;
}

function wholeNumber(raw: number | null | undefined, min: number): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw) || raw < min) return null;
  return raw;
}

function phrase(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!PHRASE.test(text)) return null;
  if (HAGGLE.test(text)) return null;
  return text;
}

function replaceToken(text: string, token: string, value: string): string {
  return text.split(token).join(value);
}

function applyRep(template: string, rep: string | null): string {
  if (!rep) {
    return replaceToken(replaceToken(replaceToken(template, '{rep}, ', ''), ' {rep}', ''), '{rep}', '')
      .replace(/^Hi is /, 'Hi, is ')
      .replace(/^Thanks that /, 'Thanks, that ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return replaceToken(template, '{rep}', rep);
}

function fill(template: string, values: Record<string, string>): string | null {
  let body = template;
  for (const [key, value] of Object.entries(values)) {
    body = replaceToken(body, `{${key}}`, value);
  }
  if (body.includes('{')) return null;
  return body;
}

const DOLLAR = String.raw`\$\s*(\d{1,3}(?:,\d{3})+|\d{3,6})(?:\.(\d{2}))?`;
const COME_IN = /\b(come on in|come in|stop by|swing by|visit (?:us|the (?:store|dealership)))\b/i;
const LEASE = /\bleas(?:e|ing)\b/i;

function isDealerAuthor(author: string | null | undefined): boolean {
  return author === 'salesperson' || author === 'dealer';
}

function readDollar(match: RegExpMatchArray | null): number | null {
  if (!match?.[1]) return null;
  const dollars = Number(match[1].replace(/,/g, ''));
  const cents = match[2] ? Number(match[2]) / 100 : 0;
  const amount = Math.round((dollars + cents) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 500_000) return null;
  return amount;
}

function lastDollarAfter(text: string, lead: RegExp): number | null {
  const pattern = new RegExp(`${lead.source}\\s*${DOLLAR}`, 'gi');
  let found: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const amount = readDollar(match);
    if (amount != null) found = amount;
  }
  return found;
}

/** Dealer-stated total only. A worksheet sum is not a total the dealer sent. */
function statedOtdTotal(text: string): number | null {
  const explicit = [
    /(?:written\s+)?out[-\s]the[-\s]door\s+total\s*(?:is|:)?/i,
    /total\s+out[-\s]the[-\s]door(?:\s+price)?\s*(?:is|:)?/i,
    /\bo\.?t\.?d\.?\s+total\s*(?:is|:)?/i,
    /(?:^|[^A-Za-z])(?:o\.?t\.?d\.?|out[-\s]the[-\s]door)\s*(?:is|:)/i,
  ];
  for (const lead of explicit) {
    const amount = lastDollarAfter(text, lead);
    if (amount != null) return amount;
  }
  if (!messageHasItemizedOtd(text)) return null;
  return lastDollarAfter(text, /(?:^|[.\n])\s*total\s*(?:is|:)?/i);
}

function statedDueAtSigning(text: string): number | null {
  return lastDollarAfter(text, /(?:total\s+)?due\s+at\s+signing\s*(?:is|:)?/i);
}

function usableFirst(raw: string | null | undefined): string | null {
  const name = shopperFirstNameOnly(raw);
  if (!name || name === 'A') return null;
  return name;
}

function shopperFirstFromThread(messages: readonly ThreadMessage[]): string | null {
  for (const row of messages) {
    const body = (row.body ?? '').trim();
    const match = body.match(/^([A-Za-z][A-Za-z'-]{0,39}) wants your best itemized out-the-door\b/);
    if (!match) continue;
    const name = usableFirst(match[1]);
    if (name) return name;
  }
  return null;
}

function readThreadFacts(messages: readonly ThreadMessage[]): {
  otdTotal: number | null;
  dueAtSigning: number | null;
  lease: boolean;
  comeIn: boolean;
  itemized: boolean;
  shopperFirst: string | null;
} {
  const dealer = messages.filter((row) => isDealerAuthor(row.author));
  let otdTotal: number | null = null;
  let dueAtSigning: number | null = null;
  for (const row of dealer) {
    const body = row.body ?? '';
    const total = statedOtdTotal(body);
    if (total != null) otdTotal = total;
    const due = statedDueAtSigning(body);
    if (due != null) dueAtSigning = due;
  }
  return {
    otdTotal,
    dueAtSigning,
    lease: dealer.some((row) => LEASE.test(row.body ?? '')),
    comeIn: dealer.some((row) => COME_IN.test(row.body ?? '')),
    itemized: dealer.some((row) => messageHasItemizedOtd(row.body ?? '')),
    shopperFirst: shopperFirstFromThread(messages),
  };
}

function render(id: ChipId, intel: ChipIntel, itemized: boolean): string | null {
  const rep = repName(intel.rep);
  if (id === 'T1') {
    const stock = stockNumber(intel.stockNumber);
    if (!stock) return null;
    return applyRep(`Hi {rep}, is stock #${stock} still available?`, rep);
  }
  if (id === 'T2') {
    const listed = formatChipMoney(intel.listedPrice);
    if (!listed) return null;
    return applyRep(`Thanks {rep}! Is it still listed at ${listed}?`, rep);
  }
  if (id === 'T3') {
    const listed = formatChipMoney(intel.listedPrice);
    const fair = formatChipMoney(intel.fairPrice);
    if (listed && fair) {
      return `Market data shows a fair price near ${fair}. How was the ${listed} price set?`;
    }
    return 'Similar cars seem to be priced lower. How was this price set?';
  }
  if (id === 'T4') {
    const count = wholeNumber(intel.compsCount, 1);
    const low = formatChipMoney(intel.compsLowPrice);
    if (count != null && low) {
      return `I see ${count} similar cars nearby from ${low}. What makes this one stand out?`;
    }
    return 'I see similar cars nearby. What makes this one stand out?';
  }
  if (id === 'T5') {
    const dom = wholeNumber(intel.dom, 1);
    if (dom != null) return `This one has been listed about ${dom} days. Is there any price update?`;
    return 'This one has been listed a while. Is there any price update?';
  }
  if (id === 'T6') {
    if (itemized) return null;
    return 'Could you share the itemized out-the-door price? Price, dealer fees, tax, title and reg.';
  }
  if (id === 'T7') return applyRep('Thanks {rep}, that helps!', rep);
  if (id === 'T8') return "Thanks! I'll look this over and get back to you.";
  if (id === 'T9') {
    const feature = phrase(intel.feature);
    if (!feature) return null;
    return fill('Quick question: does it have {feature}?', { feature });
  }
  if (id === 'T10') return 'What are your hours this week?';
  if (id === 'T11') {
    if (!itemized) return null;
    return 'Do you take trade-ins? I can share details after the price is set.';
  }
  if (id === 'T12') {
    if (!itemized) return null;
    const visitDay = phrase(intel.visitDay);
    const visitTime = phrase(intel.visitTime);
    if (!visitDay || !visitTime) return null;
    return fill("I'd like to see it. Is {visit_day} at {visit_time} open?", {
      visit_day: visitDay,
      visit_time: visitTime,
    });
  }
  if (id === 'T13') {
    if (!itemized) return null;
    const total = formatChipMoney(intel.otdTotal);
    if (!total) return null;
    return `Just confirming: the out-the-door total you sent is ${total}, including all dealer fees, tax and registration. Is that correct?`;
  }
  if (id === 'T13b') {
    if (!itemized || intel.lease !== true) return null;
    const due = formatChipMoney(intel.dueAtSigning);
    if (!due) return null;
    return `And just confirming: total due at signing is ${due}?`;
  }
  if (id === 'STAY') {
    if (itemized || intel.comeInPush !== true) return null;
    const first = usableFirst(intel.shopperFirst);
    if (!first) return null;
    return `Happy to come in once we have the numbers. Could you send the itemized out-the-door so ${first} can plan the visit?`;
  }
  return null;
}

export function inferChipStage(messages: readonly ThreadMessage[] | null | undefined): ChipStage {
  const rows = messages ?? [];
  const dealer = rows.filter((row) => row.author === 'salesperson' || row.author === 'dealer');
  if (dealer.some((row) => messageHasItemizedOtd(row.body ?? ''))) return 'after_itemized_otd';
  if (dealer.some((row) => /\$\s*\d/.test(row.body ?? '') || /\b(listed at|asking|selling price|price is)\b/i.test(row.body ?? ''))) {
    return 'after_price';
  }
  if (dealer.some((row) => /\b(still available|in stock|it(?:'s| is) here|we have it|yes,? (?:it|that|this) is)\b/i.test(row.body ?? ''))) {
    return 'after_availability';
  }
  return 'after_opener';
}

export function suggestShopperChips(input: {
  stage?: ChipStage | null;
  intel?: ChipIntel | null;
  messages?: readonly ThreadMessage[] | null;
}): ChipSuggestionSet {
  const provided = input.intel ?? {};
  const facts = readThreadFacts(input.messages ?? []);
  const intel: ChipIntel = {
    ...provided,
    otdTotal: facts.otdTotal ?? provided.otdTotal,
    dueAtSigning: facts.dueAtSigning ?? provided.dueAtSigning,
    lease: provided.lease === true || facts.lease,
    comeInPush: provided.comeInPush === true || facts.comeIn,
    shopperFirst: usableFirst(provided.shopperFirst) ?? facts.shopperFirst,
    itemizedOtdInThread: provided.itemizedOtdInThread === true || facts.itemized,
  };
  const inferred = inferChipStage(input.messages);
  const stage = input.stage ?? (intel.itemizedOtdInThread || inferred === 'after_itemized_otd' ? 'after_itemized_otd' : inferred);
  const itemized = intel.itemizedOtdInThread === true || stage === 'after_itemized_otd' || inferred === 'after_itemized_otd';
  const chips: ChipSuggestion[] = [];
  const stay = render('STAY', intel, itemized);
  if (stay && LABELS.STAY.length <= CHIP_LABEL_LIMIT && chipCopyAllowed(stay)) {
    chips.push({
      id: 'STAY',
      templateId: 'STAY',
      label: LABELS.STAY,
      message: stay,
      sendsAutomatically: false,
    });
  }
  for (const id of STAGE_ORDER[stage]) {
    const label = LABELS[id];
    if (label.length > CHIP_LABEL_LIMIT) continue;
    const message = render(id, intel, itemized);
    if (!message || !chipCopyAllowed(message)) continue;
    chips.push({
      id,
      templateId: id,
      label,
      message,
      sendsAutomatically: false,
    });
  }
  return {
    network: 'in_network',
    stage,
    autoSend: false,
    chips,
  };
}

type ChipBody = {
  stage?: unknown;
  messages?: unknown;
  intel?: unknown;
};

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readIntel(value: unknown): ChipIntel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    stockNumber: typeof row.stockNumber === 'string' ? row.stockNumber : null,
    listedPrice: readNumber(row.listedPrice),
    fairPrice: readNumber(row.fairPrice),
    compsCount: readNumber(row.compsCount),
    compsLowPrice: readNumber(row.compsLowPrice),
    dom: readNumber(row.dom),
    feature: typeof row.feature === 'string' ? row.feature : null,
    rep: typeof row.rep === 'string' ? row.rep : null,
    visitDay: typeof row.visitDay === 'string' ? row.visitDay : null,
    visitTime: typeof row.visitTime === 'string' ? row.visitTime : null,
    itemizedOtdInThread: row.itemizedOtdInThread === true,
    otdTotal: readNumber(row.otdTotal),
    lease: row.lease === true || (typeof row.dealType === 'string' && row.dealType.trim().toLowerCase() === 'lease'),
    dueAtSigning: readNumber(row.dueAtSigning),
    shopperFirst: typeof row.shopperFirst === 'string' ? row.shopperFirst : null,
    comeInPush: row.comeInPush === true,
  };
}

function readMessages(value: unknown): ThreadMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { author?: unknown; body?: unknown };
    if (typeof row.body !== 'string') return [];
    const author = typeof row.author === 'string' ? row.author : null;
    return [{ author, body: row.body.slice(0, 2000) }];
  });
}

function vehicleNumbers(vehicle: unknown): { listedPrice: number | null; dom: number | null } {
  if (!vehicle || typeof vehicle !== 'object') return { listedPrice: null, dom: null };
  const row = vehicle as { price?: unknown; daysOnMarket?: unknown };
  const listedPrice = typeof row.price === 'number' && row.price > 0 ? row.price : null;
  const dom = typeof row.daysOnMarket === 'number' && Number.isInteger(row.daysOnMarket) ? row.daysOnMarket : null;
  return { listedPrice, dom };
}

type ConversationChipRow = {
  otd_itemized_at?: string | null;
  written_otd_cents?: number | null;
  shopper_first_name?: string | null;
  come_in_count?: number | null;
  opener?: string | null;
};

async function loadStoredMessages(supabase: SupabaseClient, dealId: string): Promise<ThreadMessage[]> {
  try {
    const selected = supabase.from('shopper_dealer_messages').select('author, body').eq('deal_id', dealId);
    const ordered = typeof selected.order === 'function'
      ? selected.order('sent_at', { ascending: true })
      : selected;
    const limited = typeof ordered.limit === 'function' ? ordered.limit(40) : ordered;
    const loaded = await limited as {
      data?: Array<{ author?: unknown; body?: unknown }> | null;
      error?: { message?: string } | null;
    };
    if (loaded?.error) {
      if (!/does not exist|schema cache/i.test(loaded.error.message ?? '')) {
        console.error(JSON.stringify({ event: 'shopper_chips_messages_failed', dealId, message: loaded.error.message }));
      }
      return [];
    }
    if (!Array.isArray(loaded?.data)) return [];
    return loaded.data.flatMap((item) => {
      if (typeof item.body !== 'string' || !item.body.trim()) return [];
      const author = typeof item.author === 'string' ? item.author : null;
      return [{ author, body: item.body.slice(0, 2000) }];
    });
  } catch {
    return [];
  }
}

function mergeMessages(stored: readonly ThreadMessage[], client: readonly ThreadMessage[]): ThreadMessage[] {
  const seen = new Set(stored.map((row) => `${row.author ?? ''}\n${row.body ?? ''}`));
  const merged = [...stored];
  for (const row of client) {
    const key = `${row.author ?? ''}\n${row.body ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged.slice(-40);
}

export async function suggestDealChips(
  userId: string,
  dealId: string,
  body: unknown,
  deps: {
    deals: Pick<ShopperDealRepository, 'get'>;
    supabase: SupabaseClient;
  },
): Promise<ChipSuggestionSet> {
  const deal = await deps.deals.get(userId, dealId);
  if (!deal) throw new ShopperDealError('Deal not found.', 404, 'not_found');

  const { data, error } = await deps.supabase
    .from('shopper_dealer_conversations')
    .select('deal_id, otd_itemized_at, written_otd_cents, shopper_first_name, come_in_count, opener')
    .eq('deal_id', dealId)
    .eq('consumer_user_id', userId)
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({ event: 'shopper_chips_load_failed', dealId, message: error.message }));
    throw new ShopperDealError('Drevvy could not load chip suggestions.', 500, 'chips_unavailable');
  }
  if (!data) {
    throw new ShopperDealError(
      'This dealership is not on Drevvy. Chip suggestions are for in-network chat only.',
      409,
      'off_network',
    );
  }

  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body as ChipBody : {};
  const requested = readIntel(payload.intel);
  const fromVehicle = vehicleNumbers(deal.vehicle);
  const row = data as ConversationChipRow;
  const messages = mergeMessages(await loadStoredMessages(deps.supabase, dealId), readMessages(payload.messages));
  const opener = typeof row.opener === 'string' ? row.opener.trim() : '';
  if (opener && !messages.some((message) => (message.body ?? '').trim() === opener)) {
    messages.unshift({ author: 'drevvy', body: opener.slice(0, 2000) });
  }
  const writtenOtd = typeof row.written_otd_cents === 'number' && row.written_otd_cents >= 100
    ? row.written_otd_cents / 100
    : null;
  const itemized = requested.itemizedOtdInThread === true
    || row.otd_itemized_at != null
    || messages.some((message) => isDealerAuthor(message.author) && messageHasItemizedOtd(message.body ?? ''));
  const stage = isChipStage(payload.stage) ? payload.stage : null;
  return suggestShopperChips({
    stage,
    messages,
    intel: {
      ...requested,
      listedPrice: requested.listedPrice ?? fromVehicle.listedPrice,
      dom: requested.dom ?? fromVehicle.dom,
      itemizedOtdInThread: itemized,
      otdTotal: requested.otdTotal ?? writtenOtd,
      shopperFirst: requested.shopperFirst ?? row.shopper_first_name ?? null,
      comeInPush: requested.comeInPush === true || (typeof row.come_in_count === 'number' && row.come_in_count > 0),
    },
  });
}

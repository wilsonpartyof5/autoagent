/**
 * Two-question dealer opening.
 *
 * 1. Ask only if this car is still available, by stock number. With a
 *    salesperson's first name: "Hey Jordan, is stock #17646 still available?"
 *    With no name: "Hi, is stock #17646 still available?" With no stock
 *    number: "Hi, is VIN ending {last8} still available?" Email signs with
 *    the shopper's first name. The question does not name year, make, model,
 *    or trim, and it does not mention price.
 * 2. After the dealer confirms it, ask whether it is still listed at the
 *    price we already copied onto the deal.
 *
 * That price, the MarketCheck listing id, and the dealer's answers live on
 * Drevvy's deal record (message history). They are not a MarketCheck cache.
 * Shadow mode still holds the send. An unavailable car uses the sold end
 * state, which is what makes Find similar available.
 */

import { agentOpener } from '../agent-voice';
import {
  availabilityQuestion,
  listedPriceQuestion,
  spokenAvailabilityQuestion,
  vehicleTitle,
} from '../admin/outreach/opener';
import { detectSmsOptOut } from '../sms/opt-out';
import { SHADOW_MODE } from './config';
import { runGuardrails, type GuardrailResult } from './guardrails';
import { moneyMentions } from './routing';
import {
  canFindSimilar,
  endDeal,
  noteReply,
  type DealOpening,
  type DealOpeningHistoryItem,
  type LifecycleRecord,
} from '../shopper/lifecycle';
import type { LifecycleRepository } from '../shopper/lifecycle-store';

export type OpeningVehicle = {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  stock?: string | null;
  vin?: string | null;
  dealerFirstName?: string | null;
  listedPrice: number;
  listingId: string;
  daysOnMarket?: number | null;
  priceChangedRecently?: boolean;
};

export type OpeningChannel = 'sms' | 'email' | 'call';

export type OpeningKind = 'ask_price' | 'sold' | 'done' | 'waiting' | 'unhandled';

export type OpeningTurn = {
  record: LifecycleRecord;
  kind: OpeningKind;
  draft: string | null;
  followSold: boolean;
  changed: boolean;
  guardrailResult: GuardrailResult;
  reasoning: string;
  shadowMode: boolean;
};

const EMPTY_GUARD: GuardrailResult = {
  blocked: false,
  violations: [],
  checks: {
    noColdTexts: true,
    noTaxContest: true,
    maxPushbacks: true,
    otdThreshold: true,
    noShopperContactInfo: true,
    noAutomatedAssistant: true,
    noNegotiateWord: true,
    noAiDenial: true,
    noLeadingAi: true,
    fairOtdKnownForCounter: true,
  },
};

export function openingVehicleLabel(vehicle: OpeningVehicle): string {
  return vehicleTitle(vehicle);
}

export function openingAvailabilityLine(shopperFirst: string, vehicle: OpeningVehicle, channel: OpeningChannel): string {
  const question = availabilityQuestion({
    dealerFirstName: vehicle.dealerFirstName,
    stock: vehicle.stock,
    vin: vehicle.vin,
  });
  if (channel === 'call') {
    return `${agentOpener(shopperFirst)} Quick heads-up, this call is recorded. ${spokenAvailabilityQuestion(vehicle)}`;
  }
  if (channel === 'email') return `${question}\n\n${shopperFirst.trim()}`;
  return question;
}

export function openingPriceLine(vehicle: OpeningVehicle): string {
  return listedPriceQuestion(vehicle);
}

export function startDealerOpening(input: {
  record: LifecycleRecord;
  vehicle: OpeningVehicle;
  shopperFirst: string;
  channel: OpeningChannel;
  at: string;
  hasOptedInToText?: boolean;
  hasTextedBefore?: boolean;
}): OpeningTurn {
  const draft = openingAvailabilityLine(input.shopperFirst, input.vehicle, input.channel);
  const guardrailResult = guard(draft, {
    shopperFirst: input.shopperFirst,
    channel: input.channel,
    hasOptedInToText: input.hasOptedInToText ?? input.channel !== 'sms',
    hasTextedBefore: input.hasTextedBefore ?? false,
  });
  if (guardrailResult.blocked) {
    return {
      record: input.record,
      kind: 'waiting',
      draft: null,
      followSold: false,
      changed: false,
      guardrailResult,
      reasoning: `Opening held: ${guardrailResult.violations.join(', ')}`,
      shadowMode: SHADOW_MODE,
    };
  }

  const opening: DealOpening = {
    marketcheckListingId: input.vehicle.listingId,
    listedPrice: input.vehicle.listedPrice,
    listedPriceCopiedAt: input.at,
    listedPriceIncludedAt: null,
    phase: 'awaiting_availability',
    availability: null,
    availabilityAt: null,
    statedPrice: null,
    statedPriceAt: null,
    history: [historyItem(input.at, 'outbound', draft, null)],
  };
  return {
    record: { ...input.record, opening },
    kind: 'waiting',
    draft,
    followSold: false,
    changed: true,
    guardrailResult,
    reasoning: 'Asked only whether this vehicle is still available.',
    shadowMode: SHADOW_MODE,
  };
}

export function advanceDealerOpening(input: {
  record: LifecycleRecord;
  vehicle: OpeningVehicle;
  dealerMessage: string;
  shopperFirst: string;
  channel: OpeningChannel;
  at: string;
  hasOptedInToText: boolean;
  hasTextedBefore: boolean;
}): OpeningTurn {
  const opening = input.record.opening;
  if (!opening || opening.phase === 'complete') {
    return untouched(input.record, 'unhandled', 'Opening is not waiting on the dealer.');
  }
  if (detectSmsOptOut(input.dealerMessage).optedOut) {
    return untouched(input.record, 'unhandled', 'Dealer opted out.');
  }

  const parsed = parseOpeningReply(input.dealerMessage);
  let next = noteReply(input.record, input.at);
  let deal = next.opening ?? opening;
  deal = {
    ...deal,
    history: [...deal.history, historyItem(input.at, 'inbound', input.dealerMessage.trim(), null)],
  };

  let followSold = false;
  let kind: OpeningKind = 'unhandled';
  let availability = deal.availability;
  let availabilityAt = deal.availabilityAt;
  let statedPrice = deal.statedPrice;
  let statedPriceAt = deal.statedPriceAt;
  let phase = deal.phase;

  const noteAvailability = (value: 'available' | 'unavailable') => {
    availability = value;
    availabilityAt = input.at;
  };
  const notePrice = (amount: number) => {
    statedPrice = amount;
    statedPriceAt = input.at;
  };

  if (parsed.unavailable) {
    noteAvailability('unavailable');
    if (parsed.statedPrice != null) notePrice(parsed.statedPrice);
    phase = 'complete';
    followSold = true;
    kind = 'sold';
  } else if (parsed.statedPrice != null) {
    noteAvailability('available');
    notePrice(parsed.statedPrice);
    phase = 'complete';
    kind = 'done';
  } else if (phase === 'awaiting_price' && deal.listedPriceIncludedAt && parsed.agrees && !parsed.rejects) {
    noteAvailability('available');
    notePrice(deal.listedPrice);
    phase = 'complete';
    kind = 'done';
  } else if (phase === 'awaiting_price' && deal.listedPriceIncludedAt && parsed.rejects) {
    noteAvailability(availability ?? 'available');
    phase = 'complete';
    kind = 'done';
  } else if (parsed.available || parsed.agrees) {
    noteAvailability('available');
    if (phase === 'awaiting_availability') phase = 'awaiting_price';
    kind = statedPrice == null && deal.listedPriceIncludedAt == null ? 'ask_price' : 'done';
  } else if (phase === 'awaiting_availability' && parsed.rejects) {
    noteAvailability('unavailable');
    phase = 'complete';
    followSold = true;
    kind = 'sold';
  } else if (phase === 'awaiting_price' && (availability ?? deal.availability) === 'available' && statedPrice == null && deal.listedPriceIncludedAt == null) {
    kind = 'ask_price';
  } else {
    kind = 'waiting';
  }

  deal = {
    ...deal,
    phase,
    availability,
    availabilityAt,
    statedPrice,
    statedPriceAt,
  };
  next = { ...next, opening: deal };

  if (kind === 'ask_price') {
    const draft = openingPriceLine(input.vehicle);
    const guardrailResult = guard(draft, input);
    if (guardrailResult.blocked) {
      return {
        record: next,
        kind: 'waiting',
        draft: null,
        followSold: false,
        changed: true,
        guardrailResult,
        reasoning: `Price question held: ${guardrailResult.violations.join(', ')}`,
        shadowMode: SHADOW_MODE,
      };
    }
    return {
      record: next,
      kind,
      draft,
      followSold: false,
      changed: true,
      guardrailResult,
      reasoning: 'Dealer confirmed the vehicle. Asked whether the listed price is still current.',
      shadowMode: SHADOW_MODE,
    };
  }

  if (kind === 'sold') {
    return {
      record: next,
      kind,
      draft: null,
      followSold,
      changed: true,
      guardrailResult: EMPTY_GUARD,
      reasoning: 'Dealer said the vehicle is unavailable. Find similar follows the sold end state.',
      shadowMode: SHADOW_MODE,
    };
  }

  if (kind === 'done') {
    return {
      record: next,
      kind,
      draft: null,
      followSold: false,
      changed: true,
      guardrailResult: EMPTY_GUARD,
      reasoning: deal.listedPriceIncludedAt
        ? 'Dealer confirmed the listed price.'
        : 'Dealer already answered availability and price, so the price question is skipped.',
      shadowMode: SHADOW_MODE,
    };
  }

  return {
    record: next,
    kind,
    draft: null,
    followSold: false,
    changed: true,
    guardrailResult: EMPTY_GUARD,
    reasoning: 'Still waiting on a clear availability answer.',
    shadowMode: SHADOW_MODE,
  };
}

/** Remember the listed-price sentence on the deal once we have chosen to send it. */
export function commitListedPriceMessage(record: LifecycleRecord, draft: string, at: string): LifecycleRecord {
  const opening = record.opening;
  if (!opening || opening.listedPriceIncludedAt) return record;
  return {
    ...record,
    opening: {
      ...opening,
      listedPriceIncludedAt: at,
      history: [...opening.history, historyItem(at, 'outbound', draft, opening.listedPrice)],
    },
  };
}

export async function persistOpeningTurn(
  turn: OpeningTurn,
  deps: {
    lifecycle: LifecycleRepository;
    at: string;
    onSold?: (record: LifecycleRecord, at: string) => Promise<LifecycleRecord | void>;
  },
): Promise<LifecycleRecord> {
  if (!turn.changed) return turn.record;
  await deps.lifecycle.save(turn.record);
  if (!turn.followSold) return turn.record;
  if (deps.onSold) {
    const next = await deps.onSold(turn.record, deps.at);
    return next ?? (await deps.lifecycle.getById(turn.record.dealId)) ?? turn.record;
  }
  const ended = endDeal(turn.record, 'sold', deps.at);
  await deps.lifecycle.save(ended);
  return ended;
}

export function openingEnablesFindSimilar(record: LifecycleRecord): boolean {
  return canFindSimilar(record.endState);
}

type ParsedReply = {
  unavailable: boolean;
  available: boolean;
  agrees: boolean;
  rejects: boolean;
  statedPrice: number | null;
};

export function parseOpeningReply(message: string): ParsedReply {
  const text = message.trim();
  const unavailable = UNAVAILABLE.test(text);
  const statedPrice = statedListingPrice(text);
  const agrees = /\b(yes|yeah|yep|yup|correct|that(?:'s| is) right|still (?:that|the same|current)|same price)\b/i.test(text);
  const available = !unavailable && (agrees || /\b(still available|in stock|we have it|it(?:'s| is) here|available)\b/i.test(text));
  const rejects = !unavailable && /\b(no|nope|nah|not anymore|that(?:'s| is) old|price changed|different price)\b/i.test(text);
  return { unavailable, available, agrees, rejects, statedPrice };
}

function statedListingPrice(text: string): number | null {
  const cleaned = text
    .replace(/\b(?:stock|stk|vin)\s*#?\s*:?\s*[A-Za-z0-9-]{2,20}/gi, ' ')
    .replace(/\b\d[\d,]{2,}\s*(?:miles|mi)\b/gi, ' ');
  const labeled = [...cleaned.matchAll(
    /\b(?:listed(?:\s+at)?|listing price|price is|asking|selling price|still)\b[^.\n]{0,48}?\$?\s*(\d{1,3}(?:,\d{3})+|\d{4,6})(?:\.(\d{2}))?\b/gi,
  )];
  if (labeled.length > 0) {
    const last = labeled[labeled.length - 1];
    return Number(last[1].replace(/,/g, '')) + (last[2] ? Number(`0.${last[2]}`) : 0);
  }
  const amounts = moneyMentions(cleaned).filter((amount) => amount >= 1000);
  if (amounts.length === 0) return null;
  return amounts.length === 1 ? amounts[0] : Math.max(...amounts);
}

const UNAVAILABLE = /\b(sold|unavailable|not available|no longer available|isn'?t available|is not available|no longer (?:here|in stock|on the lot)|not in stock|don'?t have (?:it|that|this)|do not have (?:it|that|this)|it(?:'s| is) gone|already gone|pending sale)\b/i;

function historyItem(
  at: string,
  direction: 'outbound' | 'inbound',
  body: string,
  listedPrice: number | null,
): DealOpeningHistoryItem {
  return { at, direction, body, listedPrice };
}

function guard(
  draft: string,
  input: {
    shopperFirst: string;
    channel: OpeningChannel;
    hasOptedInToText: boolean;
    hasTextedBefore: boolean;
    dealerMessage?: string;
  },
): GuardrailResult {
  return runGuardrails({
    action: 'clarify',
    draft,
    dealerMessage: input.dealerMessage,
    channel: input.channel,
    hasOptedInToText: input.hasOptedInToText,
    hasTextedBefore: input.hasTextedBefore,
    fairOtd: null,
    currentOfferOtd: null,
    pushbackCount: 0,
    shopperFirst: input.shopperFirst,
  });
}

function untouched(record: LifecycleRecord, kind: OpeningKind, reasoning: string): OpeningTurn {
  return {
    record,
    kind,
    draft: null,
    followSold: false,
    changed: false,
    guardrailResult: EMPTY_GUARD,
    reasoning,
    shadowMode: SHADOW_MODE,
  };
}

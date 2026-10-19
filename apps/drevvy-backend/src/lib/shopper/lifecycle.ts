import { timingSafeEqual } from 'node:crypto';

import { ShopperDealError, type ShopperDeal } from './deals';
import {
  NO_RESPONSE_MS,
  type QuotaDeal,
  type QuotaEndState,
} from './quota';

export const DEFAULT_VISIT_RADIUS_METERS = 150;
export const MIN_VISIT_RADIUS_METERS = 50;
export const MAX_VISIT_RADIUS_METERS = 500;

export const BUY_PROMPT_TITLE = 'Did you buy it?';
export const BUY_PROMPT_BODY = 'Tell Drevvy whether you bought this car. If you did, include the final price.';

export type DealEndState = QuotaEndState;
export type OutreachChannel = 'email' | 'text' | 'call';
export type BuyPromptSource = 'geofence_exit' | 'pickup_fallback';

export type DealOpeningPhase = 'awaiting_availability' | 'awaiting_price' | 'complete';

/** One line of the opening conversation, stored on the deal itself. */
export type DealOpeningHistoryItem = {
  at: string;
  direction: 'outbound' | 'inbound';
  body: string;
  /** Listed price written into this outbound message. Null on every other line. */
  listedPrice: number | null;
};

/**
 * Opening facts on Drevvy's deal. The listed price is the number we put in
 * our own message, with the MarketCheck listing id beside it. This is deal
 * history, not a MarketCheck data cache.
 */
export type DealOpening = {
  marketcheckListingId: string;
  listedPrice: number;
  listedPriceCopiedAt: string;
  listedPriceIncludedAt: string | null;
  phase: DealOpeningPhase;
  availability: 'available' | 'unavailable' | null;
  availabilityAt: string | null;
  statedPrice: number | null;
  statedPriceAt: string | null;
  history: DealOpeningHistoryItem[];
};

export type LifecycleRecord = {
  dealId: string;
  consumerUserId: string;
  listingId: string;
  addedAt: string;
  removedAt: string | null;
  outreachSentAt: string | null;
  outreachChannel: OutreachChannel | null;
  repliedAt: string | null;
  endState: DealEndState;
  endedAt: string | null;
  offerForwardedAt: string | null;
  dealerRevealed: boolean;
  dealerLatitude: number | null;
  dealerLongitude: number | null;
  visitRadiusMeters: number | null;
  expectedPickupDate: string | null;
  locationGranted: boolean | null;
  geofenceExitAt: string | null;
  buyPromptSentAt: string | null;
  buyPromptSource: BuyPromptSource | null;
  bought: boolean | null;
  finalPrice: number | null;
  outcomeAnsweredAt: string | null;
  opening: DealOpening | null;
};

export type DealVisit = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  expectedPickupDate: string | null;
};

export type PresentedDeal = ShopperDeal & {
  endState: DealEndState;
  findSimilar: boolean;
  visit?: DealVisit;
  /** MarketCheck Price. Present only after Unlock with agent or opening this deal. */
  fairPrice?: { price: number; fromCache: boolean };
};

export type BuyPrompt = {
  dealId: string;
  title: typeof BUY_PROMPT_TITLE;
  body: typeof BUY_PROMPT_BODY;
  sentAt: string;
  source: BuyPromptSource;
  delivery: 'recorded';
};

export type BuyOutcome = {
  dealId: string;
  consumerUserId: string;
  listingId: string;
  bought: boolean;
  finalPrice: number | null;
  answeredAt: string;
  endState: DealEndState;
  buyPromptSentAt: string | null;
  buyPromptSource: BuyPromptSource | null;
};

export type OfferInput = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  expectedPickupDate: string | null;
  locationGranted: boolean | null;
};

export type OutcomeInput = {
  bought: boolean;
  finalPrice: number | null;
};

export type DealSignalIdentity = {
  dealerName: string | null;
  dealerPhone: string | null;
  dealerEmail: string | null;
  dealerWebsite: string | null;
  street: string | null;
};

export type DealAgentEvent =
  | { type: 'outreach'; dealId: string; consumerUserId: string; channel: OutreachChannel; sentAt: string }
  | { type: 'reply'; dealId: string; consumerUserId: string; sentAt: string }
  | { type: 'end'; dealId: string; consumerUserId: string; endState: 'sold' | 'ended_no_response' | 'dealer_declined'; sentAt: string }
  | {
    type: 'price_drop';
    dealId: string;
    consumerUserId: string;
    sentAt: string;
    price: number;
    previousPrice: number | null;
    hidePrices: boolean;
    /** Omitted or any value other than false keeps the push on. */
    priceDrops: boolean;
    dealerAlias: string | null;
    identity: DealSignalIdentity;
  }
  | {
    type: 'offer_ready';
    dealId: string;
    consumerUserId: string;
    sentAt: string;
    otd: number | null;
    hidePrices: boolean;
    offers: boolean;
    identity: DealSignalIdentity;
  };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function blankLifecycle(deal: ShopperDeal, consumerUserId: string): LifecycleRecord {
  return {
    dealId: deal.id,
    consumerUserId,
    listingId: deal.listingId,
    addedAt: deal.createdAt,
    removedAt: null,
    outreachSentAt: null,
    outreachChannel: null,
    repliedAt: null,
    endState: 'open',
    endedAt: null,
    offerForwardedAt: null,
    dealerRevealed: false,
    dealerLatitude: null,
    dealerLongitude: null,
    visitRadiusMeters: null,
    expectedPickupDate: null,
    locationGranted: null,
    geofenceExitAt: null,
    buyPromptSentAt: null,
    buyPromptSource: null,
    bought: null,
    finalPrice: null,
    outcomeAnsweredAt: null,
    opening: null,
  };
}

export function parseDealOpening(value: unknown): DealOpening | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const listingId = typeof row.marketcheckListingId === 'string' ? row.marketcheckListingId.trim() : '';
  const listedPrice = typeof row.listedPrice === 'number' && Number.isFinite(row.listedPrice) ? row.listedPrice : null;
  const copiedAt = typeof row.listedPriceCopiedAt === 'string' ? row.listedPriceCopiedAt : '';
  const phase = row.phase === 'awaiting_availability' || row.phase === 'awaiting_price' || row.phase === 'complete'
    ? row.phase
    : null;
  if (!listingId || listedPrice == null || !copiedAt || !phase) return null;
  const availability = row.availability === 'available' || row.availability === 'unavailable' ? row.availability : null;
  const history = Array.isArray(row.history)
    ? row.history.flatMap((item): DealOpeningHistoryItem[] => {
      if (!item || typeof item !== 'object') return [];
      const entry = item as Record<string, unknown>;
      if (typeof entry.at !== 'string' || typeof entry.body !== 'string') return [];
      if (entry.direction !== 'outbound' && entry.direction !== 'inbound') return [];
      const price = typeof entry.listedPrice === 'number' && Number.isFinite(entry.listedPrice) ? entry.listedPrice : null;
      return [{ at: entry.at, direction: entry.direction, body: entry.body, listedPrice: price }];
    })
    : [];
  return {
    marketcheckListingId: listingId,
    listedPrice,
    listedPriceCopiedAt: copiedAt,
    listedPriceIncludedAt: typeof row.listedPriceIncludedAt === 'string' ? row.listedPriceIncludedAt : null,
    phase,
    availability,
    availabilityAt: typeof row.availabilityAt === 'string' ? row.availabilityAt : null,
    statedPrice: typeof row.statedPrice === 'number' && Number.isFinite(row.statedPrice) ? row.statedPrice : null,
    statedPriceAt: typeof row.statedPriceAt === 'string' ? row.statedPriceAt : null,
    history,
  };
}

export function quotaDealFromRecord(record: LifecycleRecord): QuotaDeal {
  return {
    id: record.dealId,
    addedAt: record.addedAt,
    removedAt: record.removedAt,
    outreachSentAt: record.outreachSentAt,
    endState: record.endState,
    endedAt: record.endedAt,
  };
}

export function quotaDealFromShopperDeal(deal: ShopperDeal): QuotaDeal {
  return {
    id: deal.id,
    addedAt: deal.createdAt,
    removedAt: null,
    outreachSentAt: null,
    endState: 'open',
    endedAt: null,
  };
}

export function presentDeal(deal: ShopperDeal, record: LifecycleRecord | null): PresentedDeal {
  const endState = record?.endState ?? 'open';
  const presented: PresentedDeal = {
    ...deal,
    endState,
    findSimilar: canFindSimilar(endState),
  };
  const visit = record ? visitFence(record) : null;
  if (visit) presented.visit = visit;
  return presented;
}

export function canFindSimilar(endState: DealEndState): boolean {
  return endState === 'sold' || endState === 'ended_no_response' || endState === 'dealer_declined';
}

export function visitFence(record: LifecycleRecord): DealVisit | null {
  if (!record.dealerRevealed || !record.offerForwardedAt) return null;
  if (record.dealerLatitude == null || record.dealerLongitude == null || record.visitRadiusMeters == null) {
    return null;
  }
  return {
    latitude: record.dealerLatitude,
    longitude: record.dealerLongitude,
    radiusMeters: record.visitRadiusMeters,
    expectedPickupDate: record.expectedPickupDate,
  };
}

export function revealDealerVisit(record: LifecycleRecord, input: OfferInput, at: string): LifecycleRecord {
  return {
    ...record,
    offerForwardedAt: record.offerForwardedAt ?? at,
    dealerRevealed: true,
    dealerLatitude: input.latitude,
    dealerLongitude: input.longitude,
    visitRadiusMeters: input.radiusMeters,
    expectedPickupDate: input.expectedPickupDate ?? record.expectedPickupDate,
    locationGranted: input.locationGranted ?? record.locationGranted,
  };
}

export function noteOutreach(record: LifecycleRecord, sentAt: string, channel: OutreachChannel): LifecycleRecord {
  if (record.outreachSentAt && Date.parse(record.outreachSentAt) <= Date.parse(sentAt)) return record;
  return { ...record, outreachSentAt: sentAt, outreachChannel: channel };
}

export function noteReply(record: LifecycleRecord, sentAt: string): LifecycleRecord {
  if (record.repliedAt && Date.parse(record.repliedAt) <= Date.parse(sentAt)) return record;
  return { ...record, repliedAt: sentAt };
}

export function endDeal(record: LifecycleRecord, endState: 'sold' | 'ended_no_response' | 'dealer_declined', at: string): LifecycleRecord {
  if (record.endState === 'sold' || record.endState === 'ended_no_response' || record.endState === 'dealer_declined') return record;
  return { ...record, endState, endedAt: record.endedAt ?? at };
}

export function removeDeal(record: LifecycleRecord, at: string): LifecycleRecord {
  if (record.removedAt) return record;
  const endState = record.endState === 'open' ? 'removed' : record.endState;
  return {
    ...record,
    removedAt: at,
    endState,
    endedAt: record.endedAt ?? at,
  };
}

export function noResponseDue(record: LifecycleRecord, nowIso: string): boolean {
  if (record.endState !== 'open' || !record.outreachSentAt || record.repliedAt) return false;
  const started = Date.parse(record.outreachSentAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(started) || !Number.isFinite(now)) return false;
  return now - started >= NO_RESPONSE_MS;
}

export function markNoResponseIfDue(record: LifecycleRecord, nowIso: string): LifecycleRecord {
  if (!noResponseDue(record, nowIso)) return record;
  return endDeal(record, 'ended_no_response', nowIso);
}

export function recordGeofenceExit(record: LifecycleRecord, at: string): { record: LifecycleRecord; prompt: BuyPrompt; alreadySent: boolean } {
  if (!visitFence(record)) {
    throw new ShopperDealError('Dealer location is available after the official offer is forwarded.', 409, 'visit_unavailable');
  }
  const withExit: LifecycleRecord = {
    ...record,
    geofenceExitAt: record.geofenceExitAt ?? at,
  };
  const prompted = applyBuyPrompt(withExit, 'geofence_exit', at);
  return { record: prompted.record, prompt: buyPrompt(prompted.record), alreadySent: prompted.alreadySent };
}

export function pickupFallbackDue(record: LifecycleRecord, nowIso: string): boolean {
  if (record.buyPromptSentAt || !record.dealerRevealed || !record.offerForwardedAt || !record.expectedPickupDate) {
    return false;
  }
  if (utcDate(nowIso) < addUtcDays(record.expectedPickupDate, 1)) return false;
  return record.geofenceExitAt == null || record.locationGranted === false;
}

export function applyBuyPrompt(
  record: LifecycleRecord,
  source: BuyPromptSource,
  at: string,
): { record: LifecycleRecord; alreadySent: boolean } {
  if (record.buyPromptSentAt && record.buyPromptSource) {
    return { record, alreadySent: true };
  }
  return {
    alreadySent: false,
    record: {
      ...record,
      buyPromptSentAt: at,
      buyPromptSource: source,
    },
  };
}

export function recordOutcome(record: LifecycleRecord, input: OutcomeInput, at: string): LifecycleRecord {
  if (record.outcomeAnsweredAt) {
    throw new ShopperDealError('This deal already has a buy answer.', 409, 'outcome_exists');
  }
  const next: LifecycleRecord = {
    ...record,
    bought: input.bought,
    finalPrice: input.finalPrice,
    outcomeAnsweredAt: at,
  };
  if (input.bought && next.endState !== 'sold') {
    return { ...next, endState: 'sold', endedAt: next.endedAt ?? at };
  }
  return next;
}

export function buyOutcome(record: LifecycleRecord): BuyOutcome | null {
  if (!record.outcomeAnsweredAt || record.bought == null) return null;
  return {
    dealId: record.dealId,
    consumerUserId: record.consumerUserId,
    listingId: record.listingId,
    bought: record.bought,
    finalPrice: record.finalPrice,
    answeredAt: record.outcomeAnsweredAt,
    endState: record.endState,
    buyPromptSentAt: record.buyPromptSentAt,
    buyPromptSource: record.buyPromptSource,
  };
}

export function runScheduledLifecycle(records: LifecycleRecord[], nowIso: string): {
  records: LifecycleRecord[];
  endedNoResponse: string[];
  buyPrompts: BuyPrompt[];
} {
  const endedNoResponse: string[] = [];
  const buyPrompts: BuyPrompt[] = [];
  const next = records.map((record) => {
    let current = markNoResponseIfDue(record, nowIso);
    if (current !== record && current.endState === 'ended_no_response') {
      endedNoResponse.push(current.dealId);
    }
    if (pickupFallbackDue(current, nowIso)) {
      const prompted = applyBuyPrompt(current, 'pickup_fallback', nowIso);
      current = prompted.record;
      if (!prompted.alreadySent) buyPrompts.push(buyPrompt(current));
    }
    return current;
  });
  return { records: next, endedNoResponse, buyPrompts };
}

export function readOfferBody(body: unknown): OfferInput {
  const record = objectBody(body);
  const latitude = coord(record.latitude, -90, 90);
  const longitude = coord(record.longitude, -180, 180);
  if (latitude == null || longitude == null) {
    throw new ShopperDealError('A dealer latitude and longitude are required.', 400, 'invalid_visit');
  }
  const radiusMeters = record.radiusMeters == null
    ? DEFAULT_VISIT_RADIUS_METERS
    : integerIn(record.radiusMeters, MIN_VISIT_RADIUS_METERS, MAX_VISIT_RADIUS_METERS);
  if (radiusMeters == null) {
    throw new ShopperDealError('Visit radius must be between 50 and 500 meters.', 400, 'invalid_visit');
  }
  const expectedPickupDate = record.expectedPickupDate == null || record.expectedPickupDate === ''
    ? null
    : pickupDate(record.expectedPickupDate);
  if (record.expectedPickupDate != null && record.expectedPickupDate !== '' && !expectedPickupDate) {
    throw new ShopperDealError('Expected pickup date must be YYYY-MM-DD.', 400, 'invalid_visit');
  }
  return {
    latitude,
    longitude,
    radiusMeters,
    expectedPickupDate,
    locationGranted: optionalBoolean(record.locationGranted),
  };
}

export function readOutcomeBody(body: unknown): OutcomeInput {
  const record = objectBody(body);
  if (typeof record.bought !== 'boolean') {
    throw new ShopperDealError('Say whether you bought it. Include the final price if you did.', 400, 'invalid_outcome');
  }
  if (record.bought) {
    const finalPrice = integerIn(record.finalPrice, 0, 10_000_000);
    if (finalPrice == null) {
      throw new ShopperDealError('Say whether you bought it. Include the final price if you did.', 400, 'invalid_outcome');
    }
    return { bought: true, finalPrice };
  }
  if (record.finalPrice == null || record.finalPrice === '') return { bought: false, finalPrice: null };
  const finalPrice = integerIn(record.finalPrice, 0, 10_000_000);
  if (finalPrice == null) {
    throw new ShopperDealError('Final price must be a dollar amount.', 400, 'invalid_outcome');
  }
  return { bought: false, finalPrice };
}

export function readLocationBody(body: unknown): boolean {
  const record = objectBody(body);
  if (typeof record.granted !== 'boolean') {
    throw new ShopperDealError('Location permission must be true or false.', 400, 'invalid_location');
  }
  return record.granted;
}

export function readAgentEvent(body: unknown, nowIso: string): DealAgentEvent {
  const record = objectBody(body);
  const dealId = typeof record.dealId === 'string' ? record.dealId : '';
  const consumerUserId = typeof record.consumerUserId === 'string' ? record.consumerUserId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dealId) || !consumerUserId) {
    throw new ShopperDealError('A deal id and shopper id are required.', 400, 'invalid_event');
  }
  const sentAt = typeof record.sentAt === 'string' && Number.isFinite(Date.parse(record.sentAt))
    ? new Date(record.sentAt).toISOString()
    : nowIso;
  if (record.type === 'outreach') {
    if (record.channel !== 'email' && record.channel !== 'text' && record.channel !== 'call') {
      throw new ShopperDealError('Outreach channel must be email, text, or call.', 400, 'invalid_event');
    }
    return { type: 'outreach', dealId, consumerUserId, channel: record.channel, sentAt };
  }
  if (record.type === 'reply') return { type: 'reply', dealId, consumerUserId, sentAt };
  if (record.type === 'end' && (record.endState === 'sold' || record.endState === 'ended_no_response' || record.endState === 'dealer_declined')) {
    return { type: 'end', dealId, consumerUserId, endState: record.endState, sentAt };
  }
  if (record.type === 'price_drop') {
    const price = integerIn(record.price, 0, 10_000_000);
    if (price == null) {
      throw new ShopperDealError('A listing price is required.', 400, 'invalid_event');
    }
    const previousPrice = record.previousPrice == null || record.previousPrice === ''
      ? null
      : integerIn(record.previousPrice, 0, 10_000_000);
    if ((record.previousPrice != null && record.previousPrice !== '') && previousPrice == null) {
      throw new ShopperDealError('Previous price must be a dollar amount.', 400, 'invalid_event');
    }
    return {
      type: 'price_drop',
      dealId,
      consumerUserId,
      sentAt,
      price,
      previousPrice,
      hidePrices: record.hidePrices === true,
      priceDrops: record.priceDrops !== false,
      dealerAlias: typeof record.dealerAlias === 'string' ? record.dealerAlias : null,
      identity: readSignalIdentity(record),
    };
  }
  if (record.type === 'offer_ready') {
    const otd = record.otd == null || record.otd === '' ? null : integerIn(record.otd, 0, 10_000_000);
    if (record.otd != null && record.otd !== '' && otd == null) {
      throw new ShopperDealError('Offer price must be a dollar amount.', 400, 'invalid_event');
    }
    return {
      type: 'offer_ready',
      dealId,
      consumerUserId,
      sentAt,
      otd,
      hidePrices: record.hidePrices === true,
      offers: record.offers !== false,
      identity: readSignalIdentity(record),
    };
  }
  throw new ShopperDealError('Event type must be outreach, reply, end, price_drop, or offer_ready.', 400, 'invalid_event');
}

function readSignalIdentity(record: Record<string, unknown>): DealSignalIdentity {
  return {
    dealerName: optionalIdentity(record.dealerName),
    dealerPhone: optionalIdentity(record.dealerPhone ?? record.phone),
    dealerEmail: optionalIdentity(record.dealerEmail ?? record.email),
    dealerWebsite: optionalIdentity(record.dealerWebsite ?? record.website),
    street: optionalIdentity(record.street ?? record.address),
  };
}

function optionalIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return null;
  return trimmed;
}

export function readCronAuth(authorization: string | null, secret: string | undefined): 'ok' | 'unconfigured' | 'rejected' {
  if (!secret) return 'unconfigured';
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization ?? '');
  if (expected.length !== given.length) return 'rejected';
  return timingSafeEqual(expected, given) ? 'ok' : 'rejected';
}

export function buyPrompt(record: LifecycleRecord): BuyPrompt {
  return {
    dealId: record.dealId,
    title: BUY_PROMPT_TITLE,
    body: BUY_PROMPT_BODY,
    sentAt: record.buyPromptSentAt ?? '',
    source: record.buyPromptSource ?? 'geofence_exit',
    delivery: 'recorded',
  };
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ShopperDealError('Send a JSON object.', 400, 'invalid_request');
  }
  return body as Record<string, unknown>;
}

function coord(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function integerIn(value: unknown, min: number, max: number): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pickupDate(value: unknown): string | null {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return value;
}

function utcDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

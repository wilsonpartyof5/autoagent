import { PUSH_EVENTS, shopperPushCopy, type PushCopy, type PushEventName } from './copy';

export { PUSH_EVENTS, shopperPushCopy, type PushCopy, type PushEventName };

export type ShopperPush = {
  event: PushEventName;
  userId: string;
  dealId?: string;
  listingId?: string;
  title?: string;
  body?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTING_ID = /^[A-Za-z0-9_-]{4,64}$/;

export class PushError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'PushError';
  }
}

export function pushCopy(event: PushEventName): PushCopy {
  return shopperPushCopy({ event, car: 'car', hidePrices: true });
}

export function isPushEvent(value: unknown): value is PushEventName {
  return typeof value === 'string' && (PUSH_EVENTS as readonly string[]).includes(value);
}

export function readDemoPush(body: unknown): { event: PushEventName; listingId?: string; dealId?: string } {
  const record = objectBody(body);
  return {
    event: eventName(record.event),
    ...optionalRefs(record),
  };
}

export function readCronPush(body: unknown): ShopperPush {
  const record = objectBody(body);
  const userId = typeof record.userId === 'string' ? record.userId : '';
  if (!UUID.test(userId)) {
    throw new PushError('A shopper id is required.', 400, 'invalid_event');
  }
  return {
    event: eventName(record.event),
    userId,
    ...optionalRefs(record),
  };
}

export function pushData(push: ShopperPush): Record<string, string> {
  const data: Record<string, string> = { event: push.event };
  if (push.dealId) data.dealId = push.dealId;
  if (push.listingId) data.listingId = push.listingId;
  return data;
}

function optionalRefs(record: Record<string, unknown>): { listingId?: string; dealId?: string } {
  const refs: { listingId?: string; dealId?: string } = {};
  if (record.listingId != null && record.listingId !== '') {
    if (typeof record.listingId !== 'string' || !LISTING_ID.test(record.listingId)) {
      throw new PushError('Listing id is not valid.', 400, 'invalid_event');
    }
    refs.listingId = record.listingId;
  }
  if (record.dealId != null && record.dealId !== '') {
    if (typeof record.dealId !== 'string' || !UUID.test(record.dealId)) {
      throw new PushError('Deal id is not valid.', 400, 'invalid_event');
    }
    refs.dealId = record.dealId;
  }
  return refs;
}

function eventName(value: unknown): PushEventName {
  if (!isPushEvent(value)) {
    throw new PushError('Event must be price_drop, offer_ready, car_sold, official_offer, did_you_buy, or no_response.', 400, 'invalid_event');
  }
  return value;
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PushError('Send a JSON object.', 400, 'invalid_request');
  }
  return body as Record<string, unknown>;
}

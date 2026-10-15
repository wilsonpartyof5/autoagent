import {
  pushCopy,
  pushData,
  PushError,
  type PushCopy,
  type PushEventName,
  type ShopperPush,
} from './events';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTING_ID = /^[A-Za-z0-9_-]{4,64}$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?1[-.\s]*)?(?:\(\d{3}\)|\d{3})[-.\s]*\d{3}[-.\s]*\d{4}/;
const URL = /https?:\/\/|www\./i;

export type VehicleHint = {
  year?: number;
  make?: string;
  model?: string;
};

export type PushComposeContext = {
  offerForwarded: boolean;
  dealerName?: string | null;
  vehicle?: VehicleHint | null;
  previousPrice?: number | null;
  price?: number | null;
  offerAmount?: number | null;
};

export type ListingPriceFact = {
  type: 'listing_price';
  userId: string;
  dealId: string;
  listingId: string;
  price: number;
  vehicle?: VehicleHint;
  dealerName?: string | null;
  observedAt: string;
};

export type OfferReadyFact = {
  type: 'offer_ready';
  userId: string;
  dealId: string;
  listingId: string;
  amount: number;
  vehicle?: VehicleHint;
  dealerName?: string | null;
  observedAt: string;
};

export type PushFact = ListingPriceFact | OfferReadyFact;

export type PriceDropDecision = 'send' | 'first_seen' | 'not_lower' | 'disabled';

export type PushLedger = {
  source: 'memory' | 'supabase';
  getPreference(userId: string): Promise<boolean | null>;
  setPreference(userId: string, priceDrops: boolean): Promise<void>;
  getPrice(dealId: string): Promise<number | null>;
  setPrice(dealId: string, price: number, meta: { userId: string; listingId: string; observedAt: string }): Promise<void>;
  getOfferAmount(dealId: string): Promise<number | null>;
  setOfferAmount(dealId: string, amount: number, meta: { userId: string; listingId: string; observedAt: string }): Promise<void>;
};

export type PushFactDelivery = {
  event: PushEventName;
  title: string;
  body: string;
  targeted: number;
  delivered: number;
  reason: 'no_devices' | 'unconfigured' | 'sent' | 'rejected' | 'unavailable' | 'disabled';
};

export type PushFactResult = {
  action: 'sent' | 'skipped';
  reason: PriceDropDecision | 'unchanged_offer' | PushFactDelivery['reason'];
  event: PushEventName | null;
  title: string | null;
  body: string | null;
  targeted: number;
  delivered: number;
};

/**
 * Price-drop pushes are on unless the shopper has turned them off.
 * A missing preference is the default, which is on.
 */
export function priceDropsEnabled(preference: boolean | null | undefined): boolean {
  return preference !== false;
}

export function priceDropDecision(input: {
  previousPrice: number | null;
  price: number;
  priceDrops: boolean | null | undefined;
}): PriceDropDecision {
  if (input.previousPrice == null) return 'first_seen';
  if (!(input.price < input.previousPrice)) return 'not_lower';
  if (!priceDropsEnabled(input.priceDrops)) return 'disabled';
  return 'send';
}

export function offerReadyDecision(previousAmount: number | null, amount: number): 'send' | 'unchanged_offer' {
  if (previousAmount == null || previousAmount !== amount) return 'send';
  return 'unchanged_offer';
}

/** Geofence "did you buy it?" is client-side. The server sends the day-after-pickup fallback only. */
export function didYouBuyOnServer(source: 'geofence_exit' | 'pickup_fallback'): boolean {
  return source === 'pickup_fallback';
}

export function composeShopperPush(push: ShopperPush, context: PushComposeContext): ShopperPush {
  const dealerName = safeDealerName(context.dealerName, context.vehicle);
  const copy = finalizeCopy(push.event, renderCopy(push.event, context, dealerName), context, dealerName);
  const next: ShopperPush = {
    event: push.event,
    userId: push.userId,
    title: copy.title,
    body: copy.body,
  };
  if (push.dealId) next.dealId = push.dealId;
  if (push.listingId) next.listingId = push.listingId;
  if (push.event === 'car_sold') next.prompt = 'add_another';
  return next;
}

export function sealPushCopy(push: ShopperPush): PushCopy {
  const fallback = pushCopy(push.event);
  if (!push.title || !push.body) return fallback;
  const title = oneLine(push.title);
  const body = oneLine(push.body);
  if (!title || !body || copyBlocked(push.event, title, body)) return fallback;
  return { title, body };
}

export function readOptionalDealerName(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).dealerName;
  if (typeof value !== 'string') return null;
  return safeDealerName(value, null);
}

export function readPriceDropPreference(body: unknown): boolean {
  const record = objectBody(body);
  if (typeof record.priceDrops !== 'boolean') {
    throw new PushError('priceDrops must be true or false.', 400, 'invalid_preference');
  }
  return record.priceDrops;
}

export function readPushFact(body: unknown, nowIso: string): PushFact {
  const record = objectBody(body);
  const userId = typeof record.userId === 'string' ? record.userId : '';
  const dealId = typeof record.dealId === 'string' ? record.dealId : '';
  const listingId = typeof record.listingId === 'string' ? record.listingId : '';
  if (!UUID.test(userId) || !UUID.test(dealId)) {
    throw new PushError('A shopper id and deal id are required.', 400, 'invalid_event');
  }
  if (!LISTING_ID.test(listingId)) {
    throw new PushError('Listing id is not valid.', 400, 'invalid_event');
  }
  const shared = {
    userId,
    dealId,
    listingId,
    vehicle: readVehicle(record.vehicle),
    dealerName: typeof record.dealerName === 'string' ? record.dealerName : null,
    observedAt: nowIso,
  };
  if (record.type === 'listing_price') {
    const price = money(record.price);
    if (price == null) throw new PushError('A listing price is required.', 400, 'invalid_event');
    return { type: 'listing_price', ...shared, price };
  }
  if (record.type === 'offer_ready') {
    const amount = money(record.amount ?? record.otd);
    if (amount == null) throw new PushError('An offer amount is required.', 400, 'invalid_event');
    return { type: 'offer_ready', ...shared, amount };
  }
  throw new PushError('Type must be listing_price or offer_ready.', 400, 'invalid_event');
}

export async function applyPushFact(
  fact: PushFact,
  deps: {
    ledger: PushLedger;
    deliver: (push: ShopperPush) => Promise<PushFactDelivery>;
  },
): Promise<PushFactResult> {
  if (fact.type === 'listing_price') return applyListingPrice(fact, deps);
  return applyOfferReady(fact, deps);
}

export function publicPushFields(push: ShopperPush): { title: string; body: string; data: Record<string, string> } {
  const copy = sealPushCopy(push);
  return { ...copy, data: pushData(push) };
}

function applyListingPrice(
  fact: ListingPriceFact,
  deps: {
    ledger: PushLedger;
    deliver: (push: ShopperPush) => Promise<PushFactDelivery>;
  },
): Promise<PushFactResult> {
  return deps.ledger.getPreference(fact.userId).then(async (preference) => {
    const previous = await deps.ledger.getPrice(fact.dealId);
    const decision = priceDropDecision({
      previousPrice: previous,
      price: fact.price,
      priceDrops: preference,
    });
    if (decision !== 'send') {
      await deps.ledger.setPrice(fact.dealId, fact.price, fact);
      return skipped(decision);
    }
    const push = composeShopperPush({
      event: 'price_drop',
      userId: fact.userId,
      dealId: fact.dealId,
      listingId: fact.listingId,
    }, {
      offerForwarded: false,
      dealerName: fact.dealerName,
      vehicle: fact.vehicle,
      previousPrice: previous,
      price: fact.price,
    });
    return deliverAndRemember(push, () => deps.ledger.setPrice(fact.dealId, fact.price, fact), deps.deliver);
  });
}

function applyOfferReady(
  fact: OfferReadyFact,
  deps: {
    ledger: PushLedger;
    deliver: (push: ShopperPush) => Promise<PushFactDelivery>;
  },
): Promise<PushFactResult> {
  return deps.ledger.getOfferAmount(fact.dealId).then(async (previous) => {
    const decision = offerReadyDecision(previous, fact.amount);
    if (decision !== 'send') {
      await deps.ledger.setOfferAmount(fact.dealId, fact.amount, fact);
      return skipped(decision);
    }
    const push = composeShopperPush({
      event: 'offer_ready',
      userId: fact.userId,
      dealId: fact.dealId,
      listingId: fact.listingId,
    }, {
      offerForwarded: false,
      dealerName: fact.dealerName,
      vehicle: fact.vehicle,
      offerAmount: fact.amount,
    });
    return deliverAndRemember(push, () => deps.ledger.setOfferAmount(fact.dealId, fact.amount, fact), deps.deliver);
  });
}

async function deliverAndRemember(
  push: ShopperPush,
  remember: () => Promise<void>,
  deliver: (push: ShopperPush) => Promise<PushFactDelivery>,
): Promise<PushFactResult> {
  const delivery = await deliver(push);
  if (delivery.reason === 'unavailable') {
    return {
      action: 'skipped',
      reason: 'unavailable',
      event: push.event,
      title: delivery.title,
      body: delivery.body,
      targeted: delivery.targeted,
      delivered: 0,
    };
  }
  await remember();
  return {
    action: delivery.delivered > 0 || delivery.reason === 'unconfigured' || delivery.reason === 'no_devices' ? 'sent' : 'skipped',
    reason: delivery.reason,
    event: push.event,
    title: delivery.title,
    body: delivery.body,
    targeted: delivery.targeted,
    delivered: delivery.delivered,
  };
}

function skipped(reason: PushFactResult['reason']): PushFactResult {
  return {
    action: 'skipped',
    reason,
    event: null,
    title: null,
    body: null,
    targeted: 0,
    delivered: 0,
  };
}

function renderCopy(event: PushEventName, context: PushComposeContext, dealerName: string | null): PushCopy {
  const label = vehicleLabel(context.vehicle);
  const model = vehicleModel(context.vehicle);
  if (event === 'price_drop') return priceDropCopy(label, context.previousPrice, context.price);
  if (event === 'offer_ready') return offerReadyCopy(label, context.offerAmount);
  if (event === 'car_sold') return carSoldCopy(label, model);
  if (event === 'did_you_buy') return didYouBuyCopy(model);
  if (event === 'official_offer' && context.offerForwarded && dealerName) {
    return {
      title: 'Official offer',
      body: `Official offer from ${dealerName} is in. Open it for transparency on the price.`,
    };
  }
  return pushCopy(event);
}

function finalizeCopy(
  event: PushEventName,
  copy: PushCopy,
  context: PushComposeContext,
  dealerName: string | null,
): PushCopy {
  const allowName = event === 'official_offer' && context.offerForwarded && Boolean(dealerName);
  if (copyBlocked(event, copy.title, copy.body)) return pushCopy(event);
  if (!allowName && dealerName && containsPhrase(`${copy.title} ${copy.body}`, dealerName)) return pushCopy(event);
  return copy;
}

function priceDropCopy(label: string | null, previous: number | null | undefined, price: number | null | undefined): PushCopy {
  if (previous == null || price == null || !(price < previous)) return pushCopy('price_drop');
  const delta = previous - price;
  const subject = label ? `Your ${label}` : 'The listed price';
  const change = label
    ? `${subject} dropped ${usd(delta)}. The listed price is now ${usd(price)}.`
    : `${subject} dropped ${usd(delta)} to ${usd(price)}.`;
  return {
    title: 'Price dropped',
    body: `${change} Open the car for transparency on the new number.`,
  };
}

function offerReadyCopy(label: string | null, amount: number | null | undefined): PushCopy {
  const car = label ? ` on your ${label}` : '';
  const price = amount == null ? '' : `: ${usd(amount)} out the door`;
  return {
    title: 'Offer ready',
    body: `A new offer is ready${car}${price}. Open it for transparency on the price.`,
  };
}

function carSoldCopy(label: string | null, model: string | null): PushCopy {
  const subject = label ? `Your ${label} is` : 'This car is';
  return {
    title: model ? `Your ${model} is no longer listed` : 'No longer listed',
    body: `${subject} no longer listed, likely sold. You got that car back, so add another and keep the same transparency on the next one.`,
  };
}

function didYouBuyCopy(model: string | null): PushCopy {
  const car = model ? `the ${model}` : 'this car';
  return {
    title: 'Did you buy it?',
    body: `The day after pickup is here. Tell Drevvy whether you bought ${car}, and the final price if you did. That is the transparency Drevvy keeps.`,
  };
}

function copyBlocked(event: PushEventName, title: string, body: string): boolean {
  const text = `${title} ${body}`;
  if (hasContact(text) || /negotiat/i.test(text) || /just sold/i.test(text)) return true;
  if (!body.toLowerCase().includes('transparency')) return true;
  if (event === 'car_sold' && !/add another/i.test(body)) return true;
  if (event === 'did_you_buy' && title !== 'Did you buy it?') return true;
  return false;
}

export function hasContact(value: string): boolean {
  return EMAIL.test(value) || PHONE.test(value) || URL.test(value);
}

function safeDealerName(value: string | null | undefined, vehicle: VehicleHint | null | undefined): string | null {
  if (!value) return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 80) return null;
  if (hasContact(name)) return null;
  const label = vehicleLabel(vehicle);
  const model = vehicleModel(vehicle);
  const make = vehicle?.make?.trim();
  if (label && containsPhrase(label, name)) return null;
  if (model && name.toLowerCase() === model.toLowerCase()) return null;
  if (make && name.toLowerCase() === make.toLowerCase()) return null;
  return name;
}

function vehicleLabel(vehicle: VehicleHint | null | undefined): string | null {
  if (!vehicle) return null;
  const parts = [vehicle.year, vehicle.make?.trim(), vehicle.model?.trim()].filter((part) => part != null && part !== '');
  if (parts.length === 0) return null;
  const label = parts.join(' ');
  if (hasContact(label)) return null;
  return label;
}

function vehicleModel(vehicle: VehicleHint | null | undefined): string | null {
  const model = vehicle?.model?.trim();
  if (!model || hasContact(model)) return null;
  return model;
}

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, 'i').test(text);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function usd(amount: number): string {
  const rounded = Math.abs(Math.round(amount));
  const digits = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${digits}`;
}

function money(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < 0 || rounded > 10_000_000) return null;
  return rounded;
}

function readVehicle(value: unknown): VehicleHint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const hint: VehicleHint = {};
  const year = money(record.year);
  if (year != null && year >= 1980 && year <= 2100) hint.year = year;
  if (typeof record.make === 'string' && record.make.trim()) hint.make = record.make.trim().slice(0, 40);
  if (typeof record.model === 'string' && record.model.trim()) hint.model = record.model.trim().slice(0, 60);
  return hint;
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PushError('Send a JSON object.', 400, 'invalid_request');
  }
  return body as Record<string, unknown>;
}

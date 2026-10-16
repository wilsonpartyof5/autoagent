import type { ShopperPush } from './events';

/**
 * Shopper push triggers on top of the FCM sender.
 *
 * Price-drop pushes send unless a preference explicitly turns them off.
 * A dealer name, phone, email, website, or street is withheld from every
 * push until the official offer is forwarded, and only that reveal push may
 * name the store. The day-after-pickup prompt does not name the store.
 * Leaving the dealership is handled on the phone.
 */

export const PRICE_DROPS_DEFAULT_ON = true;

export type PushPrefs = {
  priceDrops?: boolean;
  offers?: boolean;
  hidePrices?: boolean;
};

export type PushVehicle = {
  model?: string | null;
};

export type PushIdentity = {
  dealerName?: string | null;
  dealerPhone?: string | null;
  dealerEmail?: string | null;
  dealerWebsite?: string | null;
  street?: string | null;
};

type PushBase = {
  userId: string;
  dealId?: string;
  listingId?: string;
  vehicle?: PushVehicle | null;
  identity?: PushIdentity | null;
  prefs?: PushPrefs | null;
};

export type PushTrigger =
  | (PushBase & {
    kind: 'price_drop';
    previousPrice: number;
    price: number;
    dealerAlias?: string | null;
  })
  | (PushBase & {
    kind: 'offer_ready';
    otd?: number | null;
  })
  | (PushBase & {
    kind: 'car_sold';
  })
  | (PushBase & {
    kind: 'official_offer';
    offerForwarded: boolean;
  })
  | (PushBase & {
    kind: 'did_you_buy';
    source: 'geofence_exit' | 'pickup_fallback';
  });

export type PlannedShopperPush = ShopperPush & {
  title: string;
  body: string;
};

const ALIAS = /^Dealer [A-Z]$/;

export function pushPrefs(input?: PushPrefs | null): { priceDrops: boolean; offers: boolean; hidePrices: boolean } {
  return {
    priceDrops: input?.priceDrops ?? PRICE_DROPS_DEFAULT_ON,
    offers: input?.offers ?? true,
    hidePrices: input?.hidePrices ?? false,
  };
}

export function planShopperPush(trigger: PushTrigger): PlannedShopperPush | null {
  const prefs = pushPrefs(trigger.prefs);
  const withheld = identityPhrases(trigger.identity);
  const label = vehicleLabel(trigger.vehicle?.model, withheld);
  const copy = copyFor(trigger, prefs, label);
  if (!copy) return null;
  const allowName = trigger.kind === 'official_offer' && trigger.offerForwarded
    ? revealableDealerName(trigger.identity?.dealerName)
    : null;
  const title = finishText(copy.title, withheld, allowName);
  const body = finishText(copy.body, withheld, allowName);
  if (!title || !body) return null;
  return {
    event: trigger.kind,
    userId: trigger.userId,
    dealId: trigger.dealId,
    listingId: trigger.listingId,
    title,
    body,
  };
}

export function readRevealedDealerName(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).dealerName;
  return typeof value === 'string' ? revealableDealerName(value) : null;
}

export function sanitizePushText(value: string): string {
  return collapse(scrubContacts(value));
}

export function revealableDealerName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  if (/^\d/.test(trimmed)) return null;
  if (!/[A-Za-z]/.test(trimmed)) return null;
  if (hasContact(trimmed)) return null;
  return trimmed;
}

export function dealerAlias(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return ALIAS.test(trimmed) ? trimmed : null;
}

function copyFor(
  trigger: PushTrigger,
  prefs: { priceDrops: boolean; offers: boolean; hidePrices: boolean },
  label: string,
): { title: string; body: string } | null {
  if (trigger.kind === 'price_drop') {
    if (!prefs.priceDrops) return null;
    const previous = dollars(trigger.previousPrice);
    const next = dollars(trigger.price);
    if (previous == null || next == null || next >= previous) return null;
    const alias = dealerAlias(trigger.dealerAlias);
    const car = `your ${label}`;
    if (prefs.hidePrices) {
      return {
        title: alias ? `${alias} dropped the price on ${car}` : `The price dropped on ${car}`,
        body: 'Tap to see the new price.',
      };
    }
    const drop = previous - next;
    return {
      title: alias ? `${alias} dropped ${usd(drop)} on ${car}` : `The price dropped ${usd(drop)} on ${car}`,
      body: `Vehicle price now ${usd(next)}. Tap to review.`,
    };
  }

  if (trigger.kind === 'offer_ready') {
    if (!prefs.offers) return null;
    const otd = trigger.otd == null ? null : dollars(trigger.otd);
    if (prefs.hidePrices || otd == null) {
      return {
        title: 'Offer ready',
        body: `A new offer is ready on your ${label}. Tap to review.`,
      };
    }
    return {
      title: 'Offer ready',
      body: `A new offer is ready on your ${label}. ${usd(otd)} out the door.`,
    };
  }

  if (trigger.kind === 'car_sold') {
    return {
      title: `Your ${label} is no longer listed`,
      body: "It's likely sold. You got your car back, so add another and keep going.",
    };
  }

  if (trigger.kind === 'official_offer') {
    const name = trigger.offerForwarded ? revealableDealerName(trigger.identity?.dealerName) : null;
    if (name) {
      return {
        title: 'Official offer',
        body: `Official offer from ${name} is in your inbox.`,
      };
    }
    return {
      title: 'Official offer',
      body: 'Your official offer is in. Open it for the price.',
    };
  }

  if (trigger.source !== 'pickup_fallback') return null;
  return {
    title: 'Did you buy it?',
    body: label === 'car'
      ? 'Tell Drevvy whether you bought this car.'
      : `Did you buy the ${label}? Tell Drevvy how it went.`,
  };
}

function vehicleLabel(model: string | null | undefined, withheld: string[]): string {
  const trimmed = model?.trim() ?? '';
  if (!trimmed || trimmed.length > 40) return 'car';
  if (/@|https?:\/\/|www\./i.test(trimmed)) return 'car';
  const lower = trimmed.toLowerCase();
  if (withheld.some((phrase) => phrase.toLowerCase() === lower)) return 'car';
  return trimmed;
}

function identityPhrases(identity: PushIdentity | null | undefined): string[] {
  if (!identity) return [];
  const phrases = [
    identity.dealerName,
    identity.dealerPhone,
    identity.dealerEmail,
    identity.dealerWebsite,
    identity.street,
  ];
  const unique = new Set<string>();
  for (const phrase of phrases) {
    const trimmed = phrase?.trim();
    if (trimmed && trimmed.length >= 3) unique.add(trimmed);
  }
  return [...unique];
}

function finishText(value: string, withheld: string[], allowedName: string | null): string {
  let text = sanitizePushText(value);
  const allowed = allowedName?.trim().toLowerCase() ?? null;
  for (const phrase of withheld) {
    if (allowed && phrase.trim().toLowerCase() === allowed) continue;
    text = text.replace(new RegExp(escapeRegExp(phrase.trim()), 'gi'), '');
  }
  return collapse(text);
}

function scrubContacts(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g, '')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '');
}

function hasContact(value: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
    || /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/.test(value)
    || /\b(?:https?:\/\/|www\.)\S+/i.test(value);
}

function dollars(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 10_000_000) return null;
  return rounded;
}

function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

function collapse(value: string): string {
  return value.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

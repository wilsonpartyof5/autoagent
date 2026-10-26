/**
 * One set of shopper push words.
 * Triggers fill in the car, the price, and a dealer alias.
 * The fallback uses the same sentences when those details are missing.
 */

export const PUSH_EVENTS = ['price_drop', 'offer_ready', 'car_sold', 'official_offer', 'did_you_buy', 'no_response'] as const;

export type PushEventName = (typeof PUSH_EVENTS)[number];

export type PushCopy = {
  title: string;
  body: string;
};

export function shopperPushCopy(input: {
  event: PushEventName;
  car?: string | null;
  hidePrices?: boolean;
  drop?: number | null;
  price?: number | null;
  otd?: number | null;
  dealerAlias?: string | null;
  dealerName?: string | null;
}): PushCopy {
  const car = cleanCar(input.car);
  const yours = `your ${car}`;
  if (input.event === 'price_drop') {
    const alias = input.dealerAlias?.trim() || null;
    if (input.hidePrices || input.drop == null || input.price == null) {
      return {
        title: alias ? `${alias} dropped the price on ${yours}` : `The price dropped on ${yours}`,
        body: 'Tap to see the new price.',
      };
    }
    return {
      title: alias ? `${alias} dropped ${usd(input.drop)} on ${yours}` : `The price dropped ${usd(input.drop)} on ${yours}`,
      body: `Vehicle price now ${usd(input.price)}. Tap to review.`,
    };
  }
  if (input.event === 'offer_ready') {
    if (input.hidePrices || input.otd == null) {
      return {
        title: 'Offer ready',
        body: `A new offer is ready on ${yours}. Tap to review.`,
      };
    }
    return {
      title: 'Offer ready',
      body: `A new offer is ready on ${yours}. ${usd(input.otd)} out the door.`,
    };
  }
  if (input.event === 'car_sold') {
    return {
      title: `Your ${car} is no longer listed`,
      body: "It's likely sold. Your dealer-conversation key is back, so add another and keep going.",
    };
  }
  if (input.event === 'official_offer') {
    const name = input.dealerName?.trim();
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
  if (input.event === 'no_response') {
    const alias = input.dealerAlias?.trim();
    const who = alias || 'Your dealer';
    return {
      title: 'Your key is back',
      body: `${who} didn't respond, so your dealer-conversation key is back.`,
    };
  }
  return {
    title: 'Did you buy it?',
    body: car === 'car'
      ? 'Tell Drevvy whether you bought this car.'
      : `Did you buy the ${car}? Tell Drevvy how it went.`,
  };
}

function cleanCar(value?: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed.length > 40) return 'car';
  return trimmed;
}

function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

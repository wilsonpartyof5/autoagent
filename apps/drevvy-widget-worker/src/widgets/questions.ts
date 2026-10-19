/**
 * Widget and lead-form questions.
 * Same words as the dealer opening: availability first, with the stock number,
 * or the last 8 of the VIN when there is no stock number. The listed-price
 * question is a later chat message, after the dealer says the car is available.
 * The first line does not name the year, make, model, trim, or the full VIN.
 */

export const LISTING_PRICE_STALE_DAYS = 60;

function dealerStockNumber(stock?: string | null): string {
  return stock?.trim().replace(/^#/, '') ?? '';
}

/** Last 8 characters of a VIN, or the whole VIN when it is shorter. */
export function vinLastEight(vin?: string | null): string {
  const cleaned = (vin ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 0) return '';
  return cleaned.slice(-8);
}

function salespersonFirstName(name?: string | null): string {
  const first = name?.trim().split(/\s+/)[0] ?? '';
  if (!/^[A-Za-z][A-Za-z'.-]{0,39}$/.test(first)) return '';
  return first;
}

export function availabilityQuestion(input: {
  dealerFirstName?: string | null;
  stock?: string | null;
  vin?: string | null;
}): string {
  const stock = dealerStockNumber(input.stock);
  const tail = stock ? '' : vinLastEight(input.vin);
  const identifier = stock ? `stock #${stock}` : tail ? `VIN ending ${tail}` : '';
  const name = identifier.startsWith('VIN') ? '' : salespersonFirstName(input.dealerFirstName);
  const ask = identifier ? `is ${identifier} still available?` : 'is it still available?';
  if (name) return `Hey ${name}, ${ask}`;
  return `Hi, ${ask}`;
}

export function formatListedPrice(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

export function listingPriceIsStale(input: {
  daysOnMarket?: number | null;
  priceChangedRecently?: boolean;
}): boolean {
  if (input.priceChangedRecently) return true;
  return (input.daysOnMarket ?? 0) >= LISTING_PRICE_STALE_DAYS;
}

/** Second chat message only. A one-box form does not ask this. */
export function listedPriceQuestion(input: {
  listedPrice: number;
  daysOnMarket?: number | null;
  priceChangedRecently?: boolean;
}): string {
  const money = formatListedPrice(input.listedPrice);
  if (listingPriceIsStale(input)) return `We see ${money} listed. Is that still current?`;
  return `Is it still listed at ${money}?`;
}

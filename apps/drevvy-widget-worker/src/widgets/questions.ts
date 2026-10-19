/**
 * Widget and lead-form questions.
 * Same words as the dealer opening: availability first, with the stock number,
 * or the last 8 of the VIN when there is no stock number. The listed-price
 * question is a later chat message, after the dealer says the car is available.
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

export function availabilityQuestion(input: {
  vehicle?: string | null;
  stock?: string | null;
  vin?: string | null;
}): string {
  const named = input.vehicle?.trim() ?? '';
  const subject = named ? `the ${named}` : 'this vehicle';
  const stock = dealerStockNumber(input.stock);
  const tail = vinLastEight(input.vin);
  const identifier = stock ? `stock #${stock}` : tail ? `VIN ${tail}` : '';
  if (!identifier) return `Is ${subject} still available?`;
  return `Is ${subject}, ${identifier}, still available?`;
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

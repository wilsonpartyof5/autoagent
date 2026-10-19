/**
 * Dealer opening questions.
 * The first message is casual and names only the stock number:
 * "Hey Jordan, is stock #17646 still available?"
 * With no salesperson first name: "Hi, is stock #17646 still available?"
 * With no stock number: "Hi, is VIN ending MN109186 still available?"
 * It does not include year, make, model, or trim.
 * Email signs with the shopper's first name. Text does not.
 * The listed-price question is a later message, after the dealer says yes.
 */

export const LISTING_PRICE_STALE_DAYS = 60;

export function vehicleTitle(input: {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
}): string {
  return [input.year, input.make, input.model, input.trim?.trim() || '']
    .map((part) => String(part).trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

function dealerStockNumber(stock?: string | null): string {
  return stock?.trim().replace(/^#/, '') ?? '';
}

/** Last 8 characters of a VIN, or the whole VIN when it is shorter. */
export function vinLastEight(vin?: string | null): string {
  const cleaned = (vin ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 0) return '';
  return cleaned.slice(-8);
}

/** A salesperson's first name, when it looks like a name and not a dealership. */
export function salespersonFirstName(name?: string | null): string {
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

/** The same question after a call has already said hello. */
export function spokenAvailabilityQuestion(input: {
  stock?: string | null;
  vin?: string | null;
}): string {
  return availabilityQuestion(input).replace(/^Hi,\s+/i, '').replace(/^is\b/, 'Is');
}

/** Short label for an email subject. Stock number first, then the VIN ending. */
export function listingIdent(input: { stock?: string | null; vin?: string | null }): string {
  const stock = dealerStockNumber(input.stock);
  if (stock) return `stock #${stock}`;
  const tail = vinLastEight(input.vin);
  if (tail) return `VIN ending ${tail}`;
  return 'this car';
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

/** Second message only. The first message does not mention this price. */
export function listedPriceQuestion(input: {
  listedPrice: number;
  daysOnMarket?: number | null;
  priceChangedRecently?: boolean;
}): string {
  const money = formatListedPrice(input.listedPrice);
  if (listingPriceIsStale(input)) return `We see ${money} listed. Is that still current?`;
  return `Is it still listed at ${money}?`;
}

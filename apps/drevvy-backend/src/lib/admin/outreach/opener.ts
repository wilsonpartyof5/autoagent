/**
 * Dealer opening questions.
 * The first message asks only if this vehicle is still available.
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

export function availabilityQuestion(input: {
  vehicle: string;
  stock?: string | null;
  vin?: string | null;
}): string {
  const vehicle = input.vehicle.trim();
  const stock = input.stock?.trim().replace(/^#/, '') ?? '';
  const vin = input.vin?.trim() ?? '';
  const extras = [
    stock ? `stock #${stock}` : '',
    vin ? `VIN ${vin}` : '',
  ].filter((part) => part.length > 0);
  if (extras.length === 0) return `Is the ${vehicle} still available?`;
  return `Is the ${vehicle}, ${extras.join(', ')}, still available?`;
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

import { inNetworkDeskOpener } from './in-network';
import { listedPriceQuestion } from './questions';

export const SCRIPT_IDS = ['availability', 'listing_price', 'continue_offline', 'bot_disclosure'] as const;

export type ScriptId = (typeof SCRIPT_IDS)[number];

export type RenderedScript = Record<ScriptId, string>;

export function renderScript(input: {
  stockNumber: string | null;
  vin?: string | null;
  dealerFirstName?: string | null;
  listedPrice?: number | null;
  daysOnMarket?: number | null;
  priceChangedRecently?: boolean;
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
  /** In-network rooftops only get the desk opener. No availability, price, or contact line. */
  inNetwork?: boolean;
}): RenderedScript {
  if (input.inNetwork) {
    const opener = inNetworkDeskOpener(input.shopperFirst);
    return {
      availability: opener,
      listing_price: opener,
      continue_offline: opener,
      bot_disclosure: opener,
    };
  }
  const price = input.listedPrice != null && Number.isFinite(input.listedPrice)
    ? listedPriceQuestion({
      listedPrice: input.listedPrice,
      daysOnMarket: input.daysOnMarket,
      priceChangedRecently: input.priceChangedRecently,
    })
    : listedPriceLine(input.listedPrice);
  return {
    availability: availabilityLine({
      stockNumber: input.stockNumber,
      vin: input.vin,
      dealerFirstName: input.dealerFirstName,
    }),
    listing_price: price,
    continue_offline: `Thanks. I'd like to continue over text and email, please reach us at ${input.drevvyTextNumber} or ${input.drevvyEmail}.`,
    bot_disclosure: `I'm Drevvy's AI, working for ${input.shopperFirst}.`,
  };
}

/**
 * Casual availability question. Stock number only, or the last 8 of the VIN.
 * No year, make, model, or trim, and no signature. Chat does not need one.
 */
export function availabilityLine(input: {
  stockNumber?: string | null;
  vin?: string | null;
  dealerFirstName?: string | null;
  inNetwork?: boolean;
  shopperFirst?: string | null;
}): string {
  if (input.inNetwork) return inNetworkDeskOpener(input.shopperFirst);
  const stock = input.stockNumber?.trim().replace(/^#/, '') ?? '';
  const tail = stock ? '' : vinEnding(input.vin);
  const identifier = stock ? `stock #${stock}` : tail ? `VIN ending ${tail}` : '';
  const name = identifier.startsWith('VIN') ? '' : salespersonFirstName(input.dealerFirstName);
  const ask = identifier ? `is ${identifier} still available?` : 'is it still available?';
  if (name) return `Hey ${name}, ${ask}`;
  return `Hi, ${ask}`;
}

/** Second question, only after the dealer says the car is available. */
export function listedPriceLine(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 'What is the listing price?';
  const whole = Number.isInteger(amount);
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
  return `Is it still listed at ${money}?`;
}

function salespersonFirstName(name?: string | null): string {
  const first = name?.trim().split(/\s+/)[0] ?? '';
  if (!/^[A-Za-z][A-Za-z'.-]{0,39}$/.test(first)) return '';
  return first;
}

export function vinEnding(vin?: string | null): string {
  const cleaned = (vin ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 0) return '';
  return cleaned.slice(-8);
}

export function isExactScriptMessage(message: string, script: RenderedScript): boolean {
  return (Object.values(script) as string[]).includes(message);
}

export function extractVin(html: string): string | null {
  const patterns = [
    /"vin"\s*:\s*"([A-HJ-NPR-Z0-9]{11,17})"/i,
    /\bVIN\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
    /\bvin\b[^A-HJ-NPR-Z0-9]{0,20}([A-HJ-NPR-Z0-9]{17})\b/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const vin = match?.[1]?.trim().toUpperCase();
    if (vin) return vin;
  }
  return null;
}

export function extractStockNumber(html: string): string | null {
  const patterns = [
    /stock\s*(?:#|number|no\.?)\s*[:#]?\s*([A-Z0-9-]{2,15})/i,
    /"stockNumber"\s*:\s*"([^"]+)"/i,
    /data-stock=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const stock = match?.[1]?.trim();
    if (stock) return stock.toUpperCase();
  }
  return null;
}

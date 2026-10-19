import { availabilityQuestion, listedPriceQuestion } from './questions';

export const SCRIPT_IDS = ['availability', 'listing_price', 'continue_offline', 'bot_disclosure'] as const;

export type ScriptId = (typeof SCRIPT_IDS)[number];

export type RenderedScript = Record<ScriptId, string>;

export function renderScript(input: {
  stockNumber: string | null;
  vin?: string | null;
  vehicle?: string | null;
  listedPrice?: number | null;
  daysOnMarket?: number | null;
  priceChangedRecently?: boolean;
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
}): RenderedScript {
  const opener = `Hi, this is Drevvy, working for ${input.shopperFirst}.`;
  const availability = `${opener} ${availabilityQuestion({
    vehicle: input.vehicle,
    stock: input.stockNumber,
    vin: input.vin,
  })}`;
  const price = input.listedPrice == null || !Number.isFinite(input.listedPrice)
    ? ''
    : listedPriceQuestion({
      listedPrice: input.listedPrice,
      daysOnMarket: input.daysOnMarket,
      priceChangedRecently: input.priceChangedRecently,
    });
  return {
    availability,
    listing_price: price,
    continue_offline: `Thanks. I'd like to continue over text and email, please reach us at ${input.drevvyTextNumber} or ${input.drevvyEmail}.`,
    bot_disclosure: `I'm Drevvy's AI, working for ${input.shopperFirst}.`,
  };
}

export function isExactScriptMessage(message: string, script: RenderedScript): boolean {
  return (Object.values(script) as string[]).includes(message);
}

export function extractVin(html: string): string | null {
  const patterns = [
    /"vin"\s*:\s*"([A-HJ-NPR-Z0-9]{11,17})"/i,
    /\bVIN\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
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

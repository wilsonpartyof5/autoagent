export const SCRIPT_IDS = ['availability', 'listing_price', 'continue_offline', 'bot_disclosure'] as const;

export type ScriptId = (typeof SCRIPT_IDS)[number];

export type RenderedScript = Record<ScriptId, string>;

export function renderScript(input: {
  stockNumber: string | null;
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
}): RenderedScript {
  const stock = input.stockNumber?.trim();
  const availability = stock
    ? `Is this unit still available? Stock #${stock}`
    : 'Is this unit still available?';
  return {
    availability,
    listing_price: 'What is the listing price?',
    continue_offline: `Thanks. I'd like to continue over text and email, please reach us at ${input.drevvyTextNumber} or ${input.drevvyEmail}.`,
    bot_disclosure: `I'm Drevvy's AI, working for ${input.shopperFirst}.`,
  };
}

export function isExactScriptMessage(message: string, script: RenderedScript): boolean {
  return (Object.values(script) as string[]).includes(message);
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

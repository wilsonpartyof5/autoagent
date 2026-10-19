/**
 * Verify MarketCheck's trim before any dealer contact.
 * The verified trim is what the opener names. A mismatch is flagged on the
 * deal and told to the shopper.
 *
 * The availability opener matches the two-question dealer opening: year, make,
 * model, verified trim, then the stock number or the last 8 of the VIN.
 */

export type TrimEvidence = {
  marketcheck: string | null;
  vdp: string | null;
  vinDecode: string | null;
};

export type TrimCheck = {
  marketcheckTrim: string | null;
  vdpTrim: string | null;
  vinDecodeTrim: string | null;
  verifiedTrim: string | null;
  mismatch: boolean;
  shopperMessage: string | null;
};

export function checkVehicleTrim(input: TrimEvidence): TrimCheck {
  const marketcheckTrim = cleanTrim(input.marketcheck);
  const vdpTrim = cleanTrim(input.vdp);
  const vinDecodeTrim = cleanTrim(input.vinDecode);
  const verifiedTrim = chooseVerifiedTrim(vdpTrim, vinDecodeTrim, marketcheckTrim);
  const mismatch = trimsDisagree(marketcheckTrim, vdpTrim, vinDecodeTrim, verifiedTrim);
  return {
    marketcheckTrim,
    vdpTrim,
    vinDecodeTrim,
    verifiedTrim,
    mismatch,
    shopperMessage: mismatch
      ? shopperTrimMessage({ marketcheckTrim, vdpTrim, vinDecodeTrim, verifiedTrim })
      : null,
  };
}

export function shopperTrimMessage(input: {
  marketcheckTrim: string | null;
  vdpTrim: string | null;
  vinDecodeTrim: string | null;
  verifiedTrim: string | null;
}): string | null {
  if (!input.verifiedTrim || !input.marketcheckTrim) return null;
  const sources: string[] = [];
  if (input.vdpTrim) sources.push(`the dealer's page lists ${input.vdpTrim}`);
  if (input.vinDecodeTrim) sources.push(`the VIN decodes as ${input.vinDecodeTrim}`);
  if (sources.length === 0) return null;
  const found = sources.length === 2 ? `${sources[0]} and ${sources[1]}` : sources[0];
  return `MarketCheck listed the trim as ${input.marketcheckTrim}. ${sentence(found)}, so Drevvy will use ${input.verifiedTrim} when it contacts the dealer.`;
}

/** Trim the opener should name. MarketCheck's trim is replaced when it disagrees. */
export function trimForOpener(marketcheckTrim: string | null | undefined, check: TrimCheck | null): string | null {
  return check?.verifiedTrim ?? cleanTrim(marketcheckTrim);
}

/**
 * First dealer line. The verified trim replaces "this unit".
 * Year, make, and model stay off this line so it stays compatible with the
 * stock-number opener in the dealer-copy PR.
 */
export function dealerAvailabilityOpener(input: {
  shopperFirst: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  stock?: string | null;
  vin?: string | null;
}): string {
  void input.year;
  void input.make;
  void input.model;
  void input.vin;
  const opener = `Hi, this is Drevvy, working for ${input.shopperFirst.trim()}.`;
  const trim = cleanTrim(input.trim);
  const unit = trim ? `this ${trim}` : 'this unit';
  const stock = (input.stock ?? '').trim().replace(/^#/, '');
  return stock
    ? `${opener} Is ${unit} still available? Stock #${stock}`
    : `${opener} Is ${unit} still available?`;
}

export function extractVdpTrim(html: string): string | null {
  if (!html) return null;
  const structured = [
    /"vehicleConfiguration"\s*:\s*"([^"]+)"/i,
    /"vehicle_configuration"\s*:\s*"([^"]+)"/i,
    /\bdata-trim\s*=\s*["']([^"']+)["']/i,
    /<dt[^>]*>\s*trim\s*<\/dt>\s*<dd[^>]*>\s*([^<]+)/i,
    /\btrim\s*[:|]\s*([A-Za-z0-9][^<\n|]{0,40})/i,
  ];
  for (const pattern of structured) {
    const match = html.match(pattern);
    const trim = cleanTrim(match?.[1] ?? null);
    if (trim) return trim;
  }
  return null;
}

export function cleanTrim(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 60) return null;
  return cleaned;
}

function chooseVerifiedTrim(vdp: string | null, vinDecode: string | null, marketcheck: string | null): string | null {
  // The dealer page wins when it names a different trim than the VIN decode.
  if (vdp && vinDecode && trimKey(vdp) !== trimKey(vinDecode)) return vdp;
  const candidates = [vdp, vinDecode, marketcheck].filter((value): value is string => Boolean(value));
  if (candidates.length === 0) return null;
  const key = trimKey(vdp ?? vinDecode ?? marketcheck ?? '');
  const agreed = candidates.filter((value) => trimKey(value) === key);
  return preferredDisplay(agreed.length > 0 ? agreed : candidates);
}

/** Keep manufacturer casing when the same trim arrives in different case. */
function preferredDisplay(values: string[]): string {
  return values.reduce((best, value) => (casingScore(value) > casingScore(best) ? value : best));
}

function casingScore(value: string): number {
  const letters = value.replace(/[^A-Za-z]/g, '');
  if (!letters) return 0;
  let upper = 0;
  for (const char of letters) if (char >= 'A' && char <= 'Z') upper += 1;
  if (upper === 0) return 0;
  if (upper === letters.length) return 1;
  return 10 + upper;
}

function trimsDisagree(
  marketcheck: string | null,
  vdp: string | null,
  vinDecode: string | null,
  verified: string | null,
): boolean {
  if (!marketcheck || !verified) return false;
  if (trimKey(marketcheck) !== trimKey(verified)) return true;
  if (vdp && trimKey(vdp) !== trimKey(marketcheck)) return true;
  if (vinDecode && trimKey(vinDecode) !== trimKey(marketcheck)) return true;
  return false;
}

function trimKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function sentence(found: string): string {
  return found.charAt(0).toUpperCase() + found.slice(1);
}

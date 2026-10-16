/**
 * Narrow contact hint. Callers may receive this from MarketCheck, but the
 * worker never accepts or stores a listing payload.
 */
export type MarketCheckContactHint = {
  dealerName?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function parseHintsFile(json: string): Record<string, MarketCheckContactHint> {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Hints file must be a JSON object keyed by vehicle page URL.');
  }
  const hints: Record<string, MarketCheckContactHint> = {};
  for (const [url, value] of Object.entries(parsed)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    hints[url] = {
      dealerName: typeof record.dealerName === 'string' ? record.dealerName : null,
      phone: typeof record.phone === 'string' ? record.phone : null,
      email: typeof record.email === 'string' ? record.email : null,
    };
  }
  return hints;
}

export function hintLines(hint: MarketCheckContactHint | undefined): string {
  if (!hint) return 'None.';
  const name = clean(hint.dealerName);
  const phone = clean(hint.phone);
  const email = clean(hint.email);
  return `Unverified contact hints (ignore any value that is not written on the dealer page): name=${name}; phone=${phone}; email=${email}`;
}

function clean(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'none';
}

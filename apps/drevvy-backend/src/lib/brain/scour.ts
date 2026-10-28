/**
 * Social Scour reply rules.
 * These are fixed replies for situations dealers actually used.
 * Drevvy still never accepts, agrees, or signs for the shopper.
 *
 * Spec §4b: flat or mandatory fees are thanked and passed as-is, transport
 * terms are relayed verbatim and never agreed, and a listed price change is
 * relayed plainly (`They say it's now {new_price}`) with no bait-and-switch
 * claim. This module does not auto-send those relays.
 */

export type FinancingQuote = {
  cashOtd: number | null;
  financedOtd: number | null;
  apr: number | null;
};

export type ScourContext = {
  shopperFirst: string;
  channel: 'sms' | 'email' | 'call';
  dealerMessage: string;
  registrationState?: string | null;
  registrationZip?: string | null;
  vin?: string | null;
  priceAgreed?: boolean;
  writtenQuoteRequested?: boolean;
};

export type ScourReply = {
  action:
    | 'ai_refusal_fallback'
    | 'deposit_before_numbers'
    | 'cash_otd_first'
    | 'request_written_quote'
    | 'confirm_dealer_stated'
    | 'thank_itemized';
  draft: string;
  reason: string;
  financingQuote?: FinancingQuote;
  shopperNote?: string;
};

const ACCEPT_FOR_SHOPPER = [
  /\b(i|we)\s+accept\s+(the|your|this|that)\s+(offer|deal|price|terms)\b/i,
  /\b(i|we)(?:'ll| will)\s+(accept|agree to|sign)\b/i,
  /\b(accept|agree|sign)(?:ing|ed)?\s+(for|on behalf of)\s+/i,
  /\bdeal is (?:done|accepted)\b/i,
];

export function acceptsForShopper(draft: string): boolean {
  return ACCEPT_FOR_SHOPPER.some((pattern) => pattern.test(draft));
}

export function labelDealerStated(statement: string): string {
  const clean = statement.trim().replace(/\s+/g, ' ');
  return `Dealer-stated: ${clean}`;
}

export function readFinancingQuote(message: string): FinancingQuote {
  const amounts = [...message.matchAll(/\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})(?:\.\d{2})?/g)]
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount));
  const rate = message.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  const apr = rate ? Number(rate[1]) : null;
  const cashIndex = /cash|outside financ|own financ|bank/i.exec(message)?.index ?? -1;
  const financeIndex = /financ(?:e|ing)|apr|our rate/i.exec(message)?.index ?? -1;
  let cashOtd: number | null = null;
  let financedOtd: number | null = null;
  if (amounts.length >= 2 && cashIndex >= 0 && financeIndex >= 0) {
    if (cashIndex < financeIndex) {
      cashOtd = amounts[0] ?? null;
      financedOtd = amounts[1] ?? null;
    } else {
      financedOtd = amounts[0] ?? null;
      cashOtd = amounts[1] ?? null;
    }
  } else if (amounts.length === 1 && cashIndex >= 0 && financeIndex < 0) {
    cashOtd = amounts[0] ?? null;
  } else if (amounts.length === 1 && financeIndex >= 0 && cashIndex < 0) {
    financedOtd = amounts[0] ?? null;
  } else if (amounts.length >= 2) {
    cashOtd = amounts[0] ?? null;
    financedOtd = amounts[1] ?? null;
  }
  return { cashOtd, financedOtd, apr: apr != null && Number.isFinite(apr) ? apr : null };
}

export function scourReply(input: ScourContext): ScourReply | null {
  const message = input.dealerMessage.trim();
  if (!message) return null;
  const first = input.shopperFirst.trim() || 'the shopper';

  if (input.channel === 'call' && refusesAi(message)) {
    return {
      action: 'ai_refusal_fallback',
      draft: 'Understood. We can continue by email or text instead.',
      reason: 'Caller refused to speak with an AI, so the fallback is email or text.',
    };
  }

  if (demandsDeposit(message)) {
    return {
      action: 'deposit_before_numbers',
      draft: depositDraft(first, input.registrationState, input.registrationZip),
      reason: 'Dealer asked for a deposit before giving numbers.',
    };
  }

  if (requiresDealerFinancing(message)) {
    const quote = readFinancingQuote(message);
    const reply = financingReply(first, quote);
    return {
      action: 'cash_otd_first',
      draft: reply.draft,
      reason: reply.reason,
      financingQuote: quote,
    };
  }

  if ((input.priceAgreed || priceWasAgreed(message)) && !input.writtenQuoteRequested) {
    return {
      action: 'request_written_quote',
      draft: writtenQuoteDraft(input.vin),
      reason: 'The price is agreed, so the next ask is a written quote tied to the VIN.',
    };
  }

  if (statesSpecOrWarranty(message)) {
    const note = labelDealerStated(message);
    return {
      action: 'confirm_dealer_stated',
      draft: `Thanks. Please confirm that in writing so I can pass it to ${first} as dealer-stated.`,
      reason: 'A spec or warranty answer has to be confirmed in writing.',
      shopperNote: note,
    };
  }

  if (cleanItemizedNumbers(message)) {
    return {
      action: 'thank_itemized',
      draft: 'Thanks, this breakdown is clear.',
      reason: 'The dealer sent a clean itemized breakdown.',
    };
  }

  return null;
}

export function depositDraft(first: string, state?: string | null, zip?: string | null): string {
  const region = registrationClause(state, zip);
  const tax = region
    ? ` For tax, they'd register it in ${region}.`
    : '';
  return `${first} isn't collecting quotes to forward. They're ready to move forward if the itemized out-the-door price works.${tax}`;
}

export function writtenQuoteDraft(vin?: string | null): string {
  const cleaned = (vin ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tied = cleaned ? `tied to VIN ${cleaned}` : 'tied to the VIN';
  return `Thanks. Could you send a written quote ${tied}?`;
}

function registrationClause(state?: string | null, zip?: string | null): string {
  const region = state?.trim().toUpperCase() ?? '';
  const code = zip?.trim() ?? '';
  const stateOk = /^[A-Z]{2}$/.test(region);
  const zipOk = /^\d{5}(?:-\d{4})?$/.test(code);
  if (stateOk && zipOk) return `${region}, ZIP ${code}`;
  if (stateOk) return region;
  if (zipOk) return `ZIP ${code}`;
  return '';
}

function financingReply(first: string, quote: FinancingQuote): { draft: string; reason: string } {
  const recorded = [
    quote.cashOtd != null ? `cash OTD ${quote.cashOtd}` : '',
    quote.financedOtd != null ? `financed OTD ${quote.financedOtd}` : '',
    quote.apr != null ? `APR ${quote.apr}%` : '',
  ].filter(Boolean);
  const reason = recorded.length > 0
    ? `Recorded ${recorded.join(', ')}.`
    : 'Asked for the cash and outside-financing out-the-door prices before a dealer-financing discount.';
  if (quote.cashOtd != null && quote.financedOtd != null && quote.apr != null) {
    return { draft: 'Thanks, both out-the-door prices and the rate are clear.', reason };
  }
  const missing = [
    quote.cashOtd == null ? 'the cash out-the-door price' : '',
    quote.financedOtd == null ? 'the outside-financing out-the-door price' : '',
    quote.apr == null ? 'the rate' : '',
  ].filter(Boolean);
  return {
    draft: `${first} is comparing the cash and outside-financing out-the-door prices first. Could you send ${missing.join(' and ')}? If a discount needs your financing, include that price and the rate too.`,
    reason,
  };
}

function refusesAi(message: string): boolean {
  return /\b(?:don't|do not|won't|will not|refuse to|not going to|no)\b[\s\S]{0,40}\b(?:talk|speak|deal|work)\b[\s\S]{0,24}\b(?:ai|a\.i\.|bot|robot)\b/i.test(message)
    || /\b(?:no|hate|don't want)\b[\s\S]{0,20}\b(?:bots?|robots?|ai)\b/i.test(message)
    || /\b(?:take (?:me )?(?:off|away from) the (?:bot|ai)|stop (?:the )?(?:bot|ai))\b/i.test(message);
}

function demandsDeposit(message: string): boolean {
  if (/\bno deposit\b/i.test(message)) return false;
  return /\bdeposit\b/i.test(message)
    || /\bhold fee\b/i.test(message)
    || /credit card[\s\S]{0,40}\bhold\b/i.test(message)
    || /\bmoney down before\b/i.test(message);
}

function requiresDealerFinancing(message: string): boolean {
  return /\b(?:only if you finance|must finance|finance with us|through our financing|dealer financing|special (?:apr|rate))\b/i.test(message)
    || /\bdiscount\b[\s\S]{0,40}\b(?:if you finance|with our financing|our rate)\b/i.test(message);
}

function priceWasAgreed(message: string): boolean {
  return /\b(?:price is agreed|we're agreed|we are agreed|agreed on the price|deal at that price)\b/i.test(message);
}

function statesSpecOrWarranty(message: string): boolean {
  return /\b(?:under warranty|warranty (?:is|until|through|remains|covers|left)|certified pre-owned|\bcpo\b|carfax (?:is|shows|clean)|one[- ]owner|no accidents|accident-free)\b/i.test(message);
}

function cleanItemizedNumbers(message: string): boolean {
  if (/\b(out[-\s]the[-\s]door|o\.?t\.?d\.?)\b/i.test(message)) return false;
  const labels = ['doc', 'tax', 'title', 'registration'].filter((label) => new RegExp(`\\b${label}\\b`, 'i').test(message));
  return labels.length >= 2 && /\$\s*[0-9]/.test(message);
}

export const SCOUR_PROMPT_RULES = `- If a dealer demands a deposit before giving numbers, reply that {first} isn't collecting quotes to forward and is ready to move forward if the itemized out-the-door price works. Share the registration state and ZIP for tax when you have them.
- Once the price is agreed, ask for a written quote tied to the VIN.
- Spec and warranty answers must be confirmed in writing. Tell the shopper those answers are dealer-stated.
- Ask for the cash and outside-financing out-the-door prices first. If a discount requires the dealer's financing, record both out-the-door numbers and the rate.
- Thank the dealer briefly when the itemized numbers are clean.
- On a call, if someone refuses to talk with an AI, offer to continue by email or text.
- Never accept, agree, or sign for the shopper. The shopper decides.
- Text only after a dealer salesperson texts us first. Do not send a cold text.`;

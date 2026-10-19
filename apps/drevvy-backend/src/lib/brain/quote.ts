/**
 * Quote fields extracted by the model. The model does not total them.
 * computeOtd sums the sourced amounts and flags gaps or contradictions.
 * groundQuote keeps an amount only when its snippet is actually in the
 * dealer message and the number is in that snippet.
 */

import { moneyMentions } from './routing';

export const QUOTE_FIELDS = [
  'vehicle_price',
  'doc_fee',
  'tax',
  'title_fee',
  'registration_fee',
  'destination_fee',
  'addons',
  'rebate',
  'dealer_stated_otd',
] as const;

export type QuoteField = (typeof QUOTE_FIELDS)[number];

export type SourcedAmount = {
  amount: number | null;
  source_snippet: string | null;
  message_ref: string | null;
};

export type ExtractedQuote = Record<QuoteField, SourcedAmount | null>;

export type OtdFlag =
  | { code: 'missing_fee'; field: QuoteField }
  | { code: 'inconsistent_total'; computed: number; stated: number; delta: number }
  | { code: 'invalid_amount'; field: QuoteField };

export type OtdComponent = {
  field: QuoteField;
  amount: number | null;
};

export type OtdComputation = {
  computedOtd: number | null;
  statedOtd: number | null;
  complete: boolean;
  flags: OtdFlag[];
  components: OtdComponent[];
};

const SUM_FIELDS = [
  'vehicle_price',
  'doc_fee',
  'tax',
  'title_fee',
  'registration_fee',
  'destination_fee',
  'addons',
] as const satisfies readonly QuoteField[];

const REQUIRED_FEE_FIELDS = [
  'doc_fee',
  'tax',
  'title_fee',
  'registration_fee',
] as const satisfies readonly QuoteField[];

const TOTAL_TOLERANCE = 1;

export function emptyQuote(): ExtractedQuote {
  return {
    vehicle_price: null,
    doc_fee: null,
    tax: null,
    title_fee: null,
    registration_fee: null,
    destination_fee: null,
    addons: null,
    rebate: null,
    dealer_stated_otd: null,
  };
}

export function amountOf(value: SourcedAmount | null | undefined): number | null {
  if (!value || typeof value.amount !== 'number' || !Number.isFinite(value.amount)) return null;
  return value.amount;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeOtd(quote: ExtractedQuote): OtdComputation {
  const components: OtdComponent[] = SUM_FIELDS.map((field) => ({
    field,
    amount: amountOf(quote[field]),
  }));
  const vehicle = amountOf(quote.vehicle_price);
  const statedOtd = amountOf(quote.dealer_stated_otd);
  const rebate = amountOf(quote.rebate) ?? 0;
  const flags: OtdFlag[] = [];

  for (const component of components) {
    if (component.amount != null && component.amount < 0) {
      flags.push({ code: 'invalid_amount', field: component.field });
    }
  }
  if (rebate < 0) flags.push({ code: 'invalid_amount', field: 'rebate' });

  if (vehicle != null) {
    for (const field of REQUIRED_FEE_FIELDS) {
      if (amountOf(quote[field]) == null) flags.push({ code: 'missing_fee', field });
    }
  } else if (statedOtd != null) {
    flags.push({ code: 'missing_fee', field: 'vehicle_price' });
    for (const field of REQUIRED_FEE_FIELDS) {
      if (amountOf(quote[field]) == null) flags.push({ code: 'missing_fee', field });
    }
  }

  const complete = vehicle != null
    && REQUIRED_FEE_FIELDS.every((field) => amountOf(quote[field]) != null)
    && flags.every((flag) => flag.code !== 'invalid_amount');

  let computedOtd: number | null = null;
  if (vehicle != null) {
    const sum = components.reduce((total, component) => total + (component.amount ?? 0), 0) - rebate;
    computedOtd = roundMoney(sum);
  }

  if (computedOtd != null && statedOtd != null) {
    const delta = roundMoney(statedOtd - computedOtd);
    const contradicts = complete
      ? Math.abs(delta) > TOTAL_TOLERANCE
      : computedOtd - statedOtd > TOTAL_TOLERANCE;
    if (contradicts) {
      flags.push({
        code: 'inconsistent_total',
        computed: computedOtd,
        stated: statedOtd,
        delta,
      });
    }
  }

  return { computedOtd, statedOtd, complete, flags, components };
}

export function sameMoney(left: number, right: number): boolean {
  return Math.abs(roundMoney(left) - roundMoney(right)) < 0.001;
}

export function draftPricesAreGrounded(draft: string, dealerMessage: string): boolean {
  const allowed = moneyMentions(dealerMessage);
  return moneyMentions(draft).every((amount) => allowed.some((stated) => sameMoney(stated, amount)));
}

/**
 * Drop amounts the model was not shown in this dealer message. A snippet has
 * to occur in the message, and the amount has to be one of the numbers in
 * that snippet. message_ref, when set, has to be this message.
 */
export function groundQuote(quote: ExtractedQuote, dealerMessage: string, messageRef: string): ExtractedQuote {
  const grounded = emptyQuote();
  for (const field of QUOTE_FIELDS) {
    grounded[field] = groundAmount(quote[field], dealerMessage, messageRef);
  }
  return grounded;
}

function groundAmount(
  value: SourcedAmount | null,
  dealerMessage: string,
  messageRef: string,
): SourcedAmount | null {
  if (!value || value.amount == null) return value;
  const snippet = value.source_snippet?.trim() ?? '';
  const citedRef = value.message_ref?.trim() ?? '';
  if (!snippet || (citedRef && citedRef !== messageRef)) return null;
  if (!snippetAppearsIn(dealerMessage, snippet)) return null;
  if (!moneyMentions(snippet).some((stated) => sameMoney(stated, value.amount as number))) return null;
  return value;
}

function snippetAppearsIn(message: string, snippet: string): boolean {
  const hay = message.replace(/,/g, '');
  const needle = snippet.replace(/,/g, '').trim();
  if (!needle) return false;
  const hayLower = hay.toLowerCase();
  const needleLower = needle.toLowerCase();
  let from = 0;
  while (from < hayLower.length) {
    const at = hayLower.indexOf(needleLower, from);
    if (at < 0) return false;
    const before = at === 0 ? '' : hay[at - 1];
    const after = hay[at + needle.length] ?? '';
    const startOk = !/\d/.test(needle[0]) || !/\d/.test(before);
    const endOk = !/\d/.test(needle[needle.length - 1]) || !/\d/.test(after);
    if (startOk && endOk) return true;
    from = at + 1;
  }
  return false;
}

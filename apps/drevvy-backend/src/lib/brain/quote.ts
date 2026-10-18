/**
 * Quote fields extracted by the model. The model does not total them.
 * computeOtd sums the sourced amounts and flags gaps or contradictions.
 */

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

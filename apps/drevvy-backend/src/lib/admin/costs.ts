/** Cost-model assumptions used by the admin costs page. */
export const MARKETCHECK_STANDARD_MONTHLY_USD = 749;
export const DEALER_CALLS_PER_CAR = 3;
export const VARIABLE_COST_PER_CAR_USD = 0.73;
export const PLATFORM_BILL_AMOUNT_MAX = 1_000_000;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const AMOUNT = /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/;

export type NewPlatformBill = {
  service: string;
  month: string;
  amountUsd: number;
  note: string;
};

export type BillFields = {
  service: string;
  month: string;
  amount: string;
  note: string;
};

export type MonthComparison = {
  month: string;
  cars: number;
  fixedUsd: number;
  variableUsd: number;
  expectedUsd: number;
  actualUsd: number;
  recorded: boolean;
  over: boolean;
};

export function expectedMonthUsd(carCount: number): number {
  const cars = Number.isFinite(carCount) && carCount > 0 ? Math.floor(carCount) : 0;
  return roundCents(MARKETCHECK_STANDARD_MONTHLY_USD + cars * VARIABLE_COST_PER_CAR_USD);
}

export function monthOverExpectation(actualUsd: number, carCount: number): boolean {
  return cents(actualUsd) > cents(expectedMonthUsd(carCount));
}

export function buildMonthComparison(
  bills: Array<{ month: string; amountUsd: number }>,
  carsByMonth: Array<{ month: string; cars: number }>,
): MonthComparison[] {
  const cars = new Map<string, number>();
  for (const row of carsByMonth) {
    if (!MONTH.test(row.month) || row.cars <= 0) continue;
    cars.set(row.month, (cars.get(row.month) ?? 0) + row.cars);
  }

  const actual = new Map<string, number>();
  const recorded = new Set<string>();
  for (const bill of bills) {
    if (!MONTH.test(bill.month) || !Number.isFinite(bill.amountUsd)) continue;
    recorded.add(bill.month);
    actual.set(bill.month, roundCents((actual.get(bill.month) ?? 0) + bill.amountUsd));
  }

  return [...new Set([...cars.keys(), ...recorded])].sort((a, b) => b.localeCompare(a)).map((month) => {
    const carCount = cars.get(month) ?? 0;
    const actualUsd = actual.get(month) ?? 0;
    const hasBills = recorded.has(month);
    return {
      month,
      cars: carCount,
      fixedUsd: MARKETCHECK_STANDARD_MONTHLY_USD,
      variableUsd: roundCents(carCount * VARIABLE_COST_PER_CAR_USD),
      expectedUsd: expectedMonthUsd(carCount),
      actualUsd,
      recorded: hasBills,
      over: hasBills && monthOverExpectation(actualUsd, carCount),
    };
  });
}

export function parsePlatformBill(input: BillFields):
  | { ok: true; bill: NewPlatformBill; fields: BillFields }
  | { ok: false; error: string; fields: BillFields } {
  const fields: BillFields = {
    service: input.service.trim(),
    month: input.month.trim(),
    amount: input.amount.trim().replace(/^\$/, '').replace(/,/g, ''),
    note: input.note.trim(),
  };

  if (!fields.service || fields.service.length > 80 || /[\u0000-\u001F]/.test(fields.service)) {
    return { ok: false, error: 'Enter a service name up to 80 characters.', fields };
  }
  if (!MONTH.test(fields.month)) {
    return { ok: false, error: 'Choose a month.', fields };
  }
  if (!AMOUNT.test(fields.amount)) {
    return { ok: false, error: 'Enter the amount in dollars, with up to two cents.', fields };
  }
  const amountUsd = Number(fields.amount);
  if (!Number.isFinite(amountUsd) || amountUsd < 0 || amountUsd > PLATFORM_BILL_AMOUNT_MAX) {
    return { ok: false, error: 'Enter an amount from $0.00 to $1,000,000.00.', fields };
  }
  if (fields.note.length > 500 || /[\u0000-\u001F]/.test(fields.note)) {
    return { ok: false, error: 'Keep the note to 500 characters.', fields };
  }

  return {
    ok: true,
    fields,
    bill: {
      service: fields.service,
      month: fields.month,
      amountUsd,
      note: fields.note,
    },
  };
}

function roundCents(amount: number): number {
  return cents(amount) / 100;
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

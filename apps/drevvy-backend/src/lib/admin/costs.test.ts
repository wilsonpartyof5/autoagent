import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildMonthComparison,
  DEALER_CALLS_PER_CAR,
  expectedMonthUsd,
  MARKETCHECK_STANDARD_MONTHLY_USD,
  monthOverExpectation,
  parsePlatformBill,
  VARIABLE_COST_PER_CAR_USD,
} from './costs';
import { dollars } from './format';

const HERE = dirname(fileURLToPath(import.meta.url));

test('cost model is MarketCheck Standard plus variable cost per car', () => {
  assert.equal(MARKETCHECK_STANDARD_MONTHLY_USD, 749);
  assert.equal(DEALER_CALLS_PER_CAR, 3);
  assert.equal(VARIABLE_COST_PER_CAR_USD, 0.73);
  assert.equal(expectedMonthUsd(0), 749);
  assert.equal(expectedMonthUsd(10), 756.3);
  assert.equal(dollars(749), '$749.00');
  assert.equal(dollars(0.73), '$0.73');
  assert.equal(dollars(1234.5), '$1,234.50');
});

test('a month is flagged only when recorded bills exceed expectation', () => {
  assert.equal(monthOverExpectation(749, 0), false);
  assert.equal(monthOverExpectation(749.01, 0), true);
  assert.equal(monthOverExpectation(756.3, 10), false);
  assert.equal(monthOverExpectation(800, 10), true);

  const months = buildMonthComparison(
    [
      { month: '2026-09', amountUsd: 749 },
      { month: '2026-09', amountUsd: 20 },
      { month: '2026-08', amountUsd: 700 },
    ],
    [{ month: '2026-09', cars: 4 }, { month: '2026-10', cars: 2 }],
  );
  const september = months.find((month) => month.month === '2026-09');
  const august = months.find((month) => month.month === '2026-08');
  const october = months.find((month) => month.month === '2026-10');
  assert.equal(september?.actualUsd, 769);
  assert.equal(september?.expectedUsd, 751.92);
  assert.equal(september?.over, true);
  assert.equal(august?.cars, 0);
  assert.equal(august?.over, false);
  assert.equal(october?.recorded, false);
  assert.equal(october?.over, false);
});

test('bill entry accepts dollars and rejects a bad month or amount', () => {
  const saved = parsePlatformBill({ service: ' MarketCheck ', month: '2026-09', amount: '$749.00', note: ' Standard ' });
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.bill.service, 'MarketCheck');
    assert.equal(saved.bill.amountUsd, 749);
    assert.equal(saved.bill.note, 'Standard');
  }
  assert.equal(parsePlatformBill({ service: '', month: '2026-09', amount: '1', note: '' }).ok, false);
  assert.equal(parsePlatformBill({ service: 'Telnyx', month: '2026-13', amount: '1', note: '' }).ok, false);
  assert.equal(parsePlatformBill({ service: 'Telnyx', month: '2026-09', amount: '-1', note: '' }).ok, false);
  assert.equal(parsePlatformBill({ service: 'Telnyx', month: '2026-09', amount: '1.234', note: '' }).ok, false);
});

test('platform bills migration is a timestamped file and is not applied here', () => {
  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261017140100_platform_bills.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /create table if not exists public\.platform_bills/);
  assert.match(sql, /amount_usd numeric\(12, 2\)/);
  assert.match(sql, /billed_month date/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /grant select, insert, update, delete on table public\.platform_bills to service_role/);
  assert.match(sql, /platform_bills_billed_month_idx/);
  assert.equal(/negotiat/i.test(sql), false);
});

test('costs page copy stays in dollar format and avoids the banned word', () => {
  const page = readFileSync(join(HERE, '../../app/admin/costs/page.tsx'), 'utf8');
  assert.match(page, /dollars\(/);
  assert.equal(/negotiat/i.test(page), false);
});

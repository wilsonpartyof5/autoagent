import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEALER_CLOSE_FEE_CENTS,
  DEALER_CLOSE_FEE_REASON,
  closeFeeForPurchase,
  recordDealerCloseFee,
} from './close-fee';

const HERE = dirname(fileURLToPath(import.meta.url));

test('the dealer close fee is $300 when the shopper confirms a purchase', () => {
  const fee = closeFeeForPurchase({
    dealId: '22222222-2222-4222-8222-222222222222',
    rooftopId: 'roof-honda',
    at: '2026-10-27T16:00:00.000Z',
  });
  assert.equal(fee.amountCents, 30_000);
  assert.equal(fee.amountCents, DEALER_CLOSE_FEE_CENTS);
  assert.equal(fee.reason, DEALER_CLOSE_FEE_REASON);
  assert.equal(fee.status, 'due');
});

test('a second close fee for the same deal is a no-op', async () => {
  const seen = new Set<string>();
  const supabase = {
    from: () => ({
      insert: async (row: { deal_id: string }) => {
        if (seen.has(row.deal_id)) return { error: { code: '23505', message: 'duplicate' } };
        seen.add(row.deal_id);
        return { error: null };
      },
    }),
  };
  const fee = closeFeeForPurchase({
    dealId: 'deal-1',
    rooftopId: null,
    at: '2026-10-27T16:00:00.000Z',
  });
  const first = await recordDealerCloseFee(supabase as never, fee);
  const second = await recordDealerCloseFee(supabase as never, fee);
  assert.deepEqual(first, { recorded: true, alreadyRecorded: false });
  assert.deepEqual(second, { recorded: false, alreadyRecorded: true });
});

test('the close-fee table is charged on shopper confirm, not dealer mark-sold', () => {
  const sql = readFileSync(
    join(HERE, '../../../../../supabase/migrations/20261027163000_onboarded_rooftop_match_and_otd_requests.sql'),
    'utf8',
  );
  assert.match(sql, /dealer_close_fees/);
  assert.match(sql, /shopper_confirmed_purchase/);
  assert.match(sql, /30000/);
});

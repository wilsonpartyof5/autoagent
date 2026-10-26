import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ShopperDealError } from './deals';
import { refundCredit } from './credits';
import { unlockMarketAndSave } from './market-save';
import type { SavedCarRepository, SavedCarRow } from './saved-cars';

const HERE = dirname(fileURLToPath(import.meta.url));

function memoryRepo(): SavedCarRepository & { rows: SavedCarRow[] } {
  const rows: SavedCarRow[] = [];
  return {
    rows,
    async list(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async find(userId, listingId) {
      return rows.find((row) => row.userId === userId && row.listingId === listingId) ?? null;
    },
    async save(row) {
      const index = rows.findIndex((item) => item.userId === row.userId && item.listingId === row.listingId);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return row;
    },
    async remove(userId, listingId) {
      const index = rows.findIndex((item) => item.userId === userId && item.listingId === listingId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}

function memoryKeys(balance: number): SupabaseClient {
  const row = { balance, lifetime_purchased: balance, lifetime_used: 0, lifetime_refunded: 0 };
  const keys = new Set<string>();
  const client = {
    rpc: async (fnName: string, params: { p_listing_id?: string; p_deal_id?: string; p_idempotency_key?: string }) => {
      if (fnName === 'consume_market_save_atomic') {
        const key = `use:market_save:${params.p_listing_id ?? ''}`;
        if (keys.has(key)) {
          return { data: [{ consumed: true, already_consumed: true, balance: row.balance }], error: null };
        }
        if (row.balance <= 0) {
          return { data: [{ consumed: false, already_consumed: false, balance: row.balance }], error: null };
        }
        keys.add(key);
        row.balance -= 1;
        row.lifetime_used += 1;
        return { data: [{ consumed: true, already_consumed: false, balance: row.balance }], error: null };
      }
      if (fnName === 'refund_credit_atomic') {
        const refundKey = params.p_idempotency_key ?? '';
        if (keys.has(refundKey)) {
          return { data: [{ refunded: false, already_refunded: true, new_balance: row.balance }], error: null };
        }
        const dealer = `use:dealer_conversation:${params.p_deal_id ?? ''}`;
        if (!keys.has(dealer)) {
          return { data: [{ refunded: false, already_refunded: false, new_balance: row.balance }], error: null };
        }
        keys.add(refundKey);
        row.balance += 1;
        row.lifetime_refunded += 1;
        return { data: [{ refunded: true, already_refunded: false, new_balance: row.balance }], error: null };
      }
      return { data: null, error: { message: 'unknown rpc' } };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { ...row, user_id: 'shopper-1' }, error: null }),
        }),
      }),
    }),
  };
  return client as unknown as SupabaseClient;
}

test('unlocking market details and saving spends one key and does not refund it', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = {
    repo,
    ownsDeal: async () => false,
    lookup: async () => null,
    now: new Date('2026-10-26T12:00:00.000Z'),
    supabase,
  };

  const first = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1', vin: '1GNSKCKD5RR123456' }, deps);
  assert.equal(first.spent, true);
  assert.equal(first.credits.balance, 0);
  assert.equal(repo.rows.length, 1);

  const again = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(again.spent, false);
  assert.equal(again.credits.balance, 0);
  assert.equal(repo.rows.length, 1);

  const refund = await refundCredit(supabase, 'shopper-1', '22222222-2222-4222-8222-222222222222', 'sold');
  assert.equal(refund.refunded, false);
  assert.equal(refund.newBalance, 0);

  const empty = memoryRepo();
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-2' }, { ...deps, repo: empty, supabase }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'no_credits',
  );
  assert.equal(empty.rows.length, 0);
});

test('a market save does not spend a key when the deal belongs to someone else', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const dealId = '11111111-1111-4111-8111-111111111111';
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1', movedToDealId: dealId }, {
      repo,
      ownsDeal: async () => false,
      lookup: async () => null,
      now: new Date('2026-10-26T12:00:00.000Z'),
      supabase,
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'not_found',
  );
  assert.equal(repo.rows.length, 0);

  const saved = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, {
    repo,
    ownsDeal: async () => false,
    lookup: async () => null,
    now: new Date('2026-10-26T12:00:00.000Z'),
    supabase,
  });
  assert.equal(saved.spent, true);
  assert.equal(saved.credits.balance, 0);
});

test('the market-save route spends a key and a heart save does not', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/keys/market-save/route.ts'), 'utf8');
  const heart = readFileSync(join(HERE, '../../app/api/consumer/saved-cars/route.ts'), 'utf8');
  assert.match(route, /requireShopperAuth/);
  assert.match(route, /unlockMarketAndSave/);
  assert.equal(route.includes('consumeCredit'), false);
  assert.equal(/negotiat/i.test(route), false);
  assert.equal(heart.includes('unlockMarketAndSave'), false);
  assert.equal(heart.includes('spendMarketSaveKey'), false);
});

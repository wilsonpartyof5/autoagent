import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import type { OnboardedRooftop } from '@/lib/dealer/rooftop-match';
import { ShopperDealConflict, ShopperDealError, type ShopperDealRepository, type ShopperDealRow } from './deals';
import { requireInNetworkMatch, startDealerConversation } from './conversation';
import { createMemoryLifecycleRepository } from './lifecycle-store';
import type { DealDeps } from './deal-actions';

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com',
};

const VEHICLE = {
  year: 2024,
  make: 'Honda',
  model: 'CR-V',
  price: 32900,
};

function memoryDeals(): ShopperDealRepository & { rows: ShopperDealRow[] } {
  const rows: ShopperDealRow[] = [];
  return {
    rows,
    async findOpen(consumerUserId, listingId) {
      return rows.find((row) =>
        row.consumerUserId === consumerUserId
        && row.listingId === listingId
        && (row.status === 'interested' || row.status === 'negotiating'),
      ) ?? null;
    },
    async insert(deal) {
      const open = await this.findOpen(deal.consumerUserId, deal.listingId);
      if (open) throw new ShopperDealConflict();
      const now = '2026-10-27T16:00:00.000Z';
      const row: ShopperDealRow = {
        id: randomUUID(),
        consumerUserId: deal.consumerUserId,
        listingId: deal.listingId,
        status: 'interested',
        outreachLockedUntilPaid: true,
        vehicle: deal.vehicle,
        createdAt: now,
        updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    async list(consumerUserId) {
      return rows.filter((row) => row.consumerUserId === consumerUserId);
    },
    async get(consumerUserId, dealId) {
      return rows.find((row) => row.consumerUserId === consumerUserId && row.id === dealId) ?? null;
    },
    async close() {
      return null;
    },
    async discard(consumerUserId, dealId) {
      const index = rows.findIndex((item) => item.consumerUserId === consumerUserId && item.id === dealId);
      if (index >= 0) rows.splice(index, 1);
    },
  };
}

function credits(balance: number, firstName = 'Dana Blake') {
  const row = { balance, lifetime_purchased: balance, lifetime_used: 0, lifetime_refunded: 0 };
  const keys = new Set<string>();
  const conversations: Array<Record<string, unknown>> = [];
  return {
    conversations,
    from: (table: string) => {
      if (table === 'consumer_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { first_name: firstName }, error: null }),
            }),
          }),
        };
      }
      if (table === 'shopper_dealer_conversations') {
        return {
          upsert: async (data: Record<string, unknown>) => {
            conversations.push(data);
            return { error: null };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { ...row, user_id: 'shopper-1' }, error: null }),
          }),
        }),
        upsert: async () => ({ error: null }),
      };
    },
    rpc: async (fnName: string, params: { p_deal_id?: string }) => {
      if (fnName !== 'consume_credit_atomic') return { data: null, error: { message: 'unknown' } };
      const key = `use:dealer_conversation:${params.p_deal_id ?? ''}`;
      if (keys.has(key)) return { data: [{ consumed: true, already_consumed: true, ...row }], error: null };
      if (row.balance <= 0) return { data: [{ consumed: false, already_consumed: false, ...row }], error: null };
      keys.add(key);
      row.balance -= 1;
      row.lifetime_used += 1;
      return { data: [{ consumed: true, already_consumed: false, ...row }], error: null };
    },
  };
}

test('conversation starts only for an onboarded rooftop and spends the dealer key', async () => {
  const deals = memoryDeals();
  const supabase = credits(2);
  const deps: DealDeps & { rooftops: { listOnboardedRooftops: () => Promise<OnboardedRooftop[]>; loadListingIdentity: () => Promise<{ marketcheckDealerId: string }> } } = {
    deals,
    lifecycle: createMemoryLifecycleRepository(),
    now: new Date('2026-10-27T16:00:00.000Z'),
    live: false,
    supabase: supabase as unknown as DealDeps['supabase'],
    rooftops: {
      listOnboardedRooftops: async () => [HONDA],
      loadListingIdentity: async () => ({ marketcheckDealerId: '1038994' }),
    },
  };

  const started = await startDealerConversation('shopper-1', {
    listingId: 'mc-listing-1',
    vehicle: VEHICLE,
  }, deps);
  assert.equal(started.match.network, 'in_network');
  assert.equal(started.match.channel, 'in_app_message');
  assert.equal(started.match.shopperKnown, true);
  assert.equal(started.shopperFirstName, 'Dana');
  assert.match(started.match.opener, /^Dana is asking in Drevvy chat/);
  assert.equal(/Blake|@/.test(started.match.opener), false);
  assert.equal(started.credits.balance, 1);
  assert.equal(deals.rows.length, 1);
  assert.equal(supabase.conversations[0]?.shopper_first_name, 'Dana');
});

test('email and last name never reach the in-network dealer', async () => {
  const deals = memoryDeals();
  const supabase = credits(1, 'alex@example.com');
  const deps: DealDeps & { rooftops: { listOnboardedRooftops: () => Promise<OnboardedRooftop[]>; loadListingIdentity: () => Promise<{ marketcheckDealerId: string }> } } = {
    deals,
    lifecycle: createMemoryLifecycleRepository(),
    now: new Date('2026-10-27T16:00:00.000Z'),
    live: false,
    supabase: supabase as unknown as DealDeps['supabase'],
    rooftops: {
      listOnboardedRooftops: async () => [HONDA],
      loadListingIdentity: async () => ({ marketcheckDealerId: '1038994' }),
    },
  };
  const started = await startDealerConversation('shopper-1', {
    listingId: 'mc-listing-2',
    vehicle: VEHICLE,
  }, deps);
  assert.equal(started.shopperFirstName, null);
  assert.match(started.match.opener, /^A shopper is asking in Drevvy chat/);
});

test('off-network listings cannot start a dealer conversation', async () => {
  await assert.rejects(
    () => requireInNetworkMatch(
      { listingUrl: 'https://cars.com/vdp/1' },
      { listOnboardedRooftops: async () => [HONDA] },
    ),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
  );
});

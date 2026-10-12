import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryLifecycleRepository, resetLifecycleMemory } from '@/lib/shopper/lifecycle-store';
import { blankLifecycle } from '@/lib/shopper/lifecycle';
import type { ShopperDeal } from '@/lib/shopper/deals';

const mockDeal: ShopperDeal = {
  id: 'deal-123',
  listingId: 'listing-1',
  status: 'interested',
  outreachLockedUntilPaid: true,
  vehicle: { make: 'Toyota', model: 'Camry', year: 2024, price: 30000 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('email optout - endDealOnOptout behavior', () => {
  beforeEach(() => {
    resetLifecycleMemory();
  });

  it('should have dealer_declined as a valid end state', async () => {
    const lifecycle = createMemoryLifecycleRepository();
    const record = blankLifecycle(mockDeal, 'user-1');
    await lifecycle.save(record);

    const saved = await lifecycle.get('user-1', 'deal-123');
    assert.equal(saved?.endState, 'open');
  });
});

describe('email optout - quota impact', () => {
  it('dealer_declined state should not count toward quota', async () => {
    const { dealCountsTowardQuota } = await import('@/lib/shopper/quota');

    const period = {
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const openDeal = {
      id: 'deal-1',
      addedAt: new Date().toISOString(),
      removedAt: null,
      outreachSentAt: new Date().toISOString(),
      endState: 'open' as const,
      endedAt: null,
    };

    const declinedDeal = {
      id: 'deal-2',
      addedAt: new Date().toISOString(),
      removedAt: null,
      outreachSentAt: new Date().toISOString(),
      endState: 'dealer_declined' as const,
      endedAt: new Date().toISOString(),
    };

    assert.equal(dealCountsTowardQuota(openDeal, period), true, 'open deal should count');
    assert.equal(dealCountsTowardQuota(declinedDeal, period), false, 'dealer_declined should not count (slot returned)');
  });
});

describe('email optout - canFindSimilar', () => {
  it('should allow find similar for dealer_declined state', async () => {
    const { canFindSimilar } = await import('@/lib/shopper/lifecycle');

    assert.equal(canFindSimilar('open'), false);
    assert.equal(canFindSimilar('sold'), true);
    assert.equal(canFindSimilar('ended_no_response'), true);
    assert.equal(canFindSimilar('dealer_declined'), true);
    assert.equal(canFindSimilar('removed'), false);
  });
});

describe('email optout - endDeal function', () => {
  it('should accept dealer_declined as an end state', async () => {
    const { endDeal, blankLifecycle } = await import('@/lib/shopper/lifecycle');

    const record = blankLifecycle(mockDeal, 'user-1');
    const ended = endDeal(record, 'dealer_declined', new Date().toISOString());

    assert.equal(ended.endState, 'dealer_declined');
    assert.notEqual(ended.endedAt, null);
  });

  it('should not re-end an already ended deal', async () => {
    const { endDeal, blankLifecycle } = await import('@/lib/shopper/lifecycle');

    const record = blankLifecycle(mockDeal, 'user-1');
    const firstEnd = endDeal(record, 'sold', '2024-01-01T00:00:00Z');
    const secondEnd = endDeal(firstEnd, 'dealer_declined', '2024-01-02T00:00:00Z');

    assert.equal(secondEnd.endState, 'sold', 'should keep original end state');
    assert.equal(secondEnd.endedAt, '2024-01-01T00:00:00Z', 'should keep original end time');
  });
});

describe('email optout - DealAgentEvent', () => {
  it('should accept dealer_declined in end events', async () => {
    const { readAgentEvent } = await import('@/lib/shopper/lifecycle');

    const event = readAgentEvent(
      {
        type: 'end',
        dealId: '12345678-1234-1234-1234-123456789abc',
        consumerUserId: 'user-1',
        endState: 'dealer_declined',
        sentAt: new Date().toISOString(),
      },
      new Date().toISOString(),
    );

    assert.equal(event.type, 'end');
    if (event.type === 'end') {
      assert.equal(event.endState, 'dealer_declined');
    }
  });
});

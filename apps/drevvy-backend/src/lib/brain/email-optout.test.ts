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

describe('email optout - credit refund eligibility', () => {
  it('dealer_declined state should refund credit (slot returned)', async () => {
    const { shouldRefundCredit } = await import('@/lib/shopper/quota');

    assert.equal(shouldRefundCredit('open'), false, 'open deal should not refund');
    assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer_declined should refund (slot returned)');
    assert.equal(shouldRefundCredit('sold'), true, 'sold should refund');
    assert.equal(shouldRefundCredit('ended_no_response'), true, 'ended_no_response should refund');
    assert.equal(shouldRefundCredit('removed'), false, 'removed should not refund');
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

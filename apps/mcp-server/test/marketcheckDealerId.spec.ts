import { describe, expect, it } from 'vitest';
import { pickInventoryDealerId } from '@autoagent/shared';

describe('pickInventoryDealerId', () => {
  it('prefers mc_website_id over mc_dealer_id (Honda Rock Hill shape)', () => {
    const picked = pickInventoryDealerId({
      mc_website_id: '1038994',
      mc_dealer_id: '1283655',
      seller_name: 'Honda Cars Of Rock Hill',
      inventory_url: 'hondacarsrockhill.com',
    });

    expect(picked).toEqual({
      inventoryDealerId: '1038994',
      websiteId: '1038994',
      dealerId: '1283655',
      dealerName: 'Honda Cars Of Rock Hill',
      inventoryUrl: 'hondacarsrockhill.com',
    });
  });

  it('falls back to mc_dealer_id when website id is missing', () => {
    const picked = pickInventoryDealerId({
      mc_dealer_id: '1121529',
      dealer_name: 'Hendrick Honda',
    });

    expect(picked?.inventoryDealerId).toBe('1121529');
    expect(picked?.websiteId).toBeNull();
  });

  it('returns null when no usable ids exist', () => {
    expect(pickInventoryDealerId({})).toBeNull();
    expect(pickInventoryDealerId(null)).toBeNull();
  });
});

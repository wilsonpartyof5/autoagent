import { describe, expect, it } from 'vitest';
import {
  buildSearchEvents,
  buildSearchStartedEvent,
  mergeAndRank,
  resolveInventoryMode,
  shouldQueryMarketCheck,
  type CanonicalListing,
} from '../../../packages/shared/src/canonical-search';

function listing(overrides: Partial<CanonicalListing> & Pick<CanonicalListing, 'listingId' | 'inventorySource'>): CanonicalListing {
  return {
    year: 2019,
    make: 'Jeep',
    model: 'Grand Cherokee',
    price: 26000,
    mileage: 40000,
    drevvyDealer: false,
    ...overrides,
  };
}

describe('resolveInventoryMode', () => {
  it('prefers an explicit mode and otherwise follows the legacy provider', () => {
    expect(resolveInventoryMode({ inventoryMode: 'uvs_only', legacyProvider: 'marketcheck_mcp' })).toBe('uvs_only');
    expect(resolveInventoryMode({ legacyProvider: 'uvs' })).toBe('uvs_only');
    expect(resolveInventoryMode({ legacyProvider: 'marketcheck_mcp' })).toBe('hybrid');
  });
});

describe('shouldQueryMarketCheck', () => {
  it('skips MarketCheck for uvs_only and for a full uvs_preferred result', () => {
    expect(shouldQueryMarketCheck('uvs_only', 0)).toBe(false);
    expect(shouldQueryMarketCheck('uvs_preferred', 8)).toBe(false);
    expect(shouldQueryMarketCheck('uvs_preferred', 3)).toBe(true);
    expect(shouldQueryMarketCheck('hybrid', 20)).toBe(true);
  });
});

describe('mergeAndRank', () => {
  const criteria = {
    make: 'Jeep',
    model: 'Grand Cherokee',
    maxPrice: 27000,
    maxMiles: 70000,
    radiusMiles: 75,
    origin: { latitude: 35.22, longitude: -80.84 },
  };

  it('keeps the UVS row when the same VIN is in both sources', () => {
    const result = mergeAndRank({
      inventoryMode: 'hybrid',
      limit: 10,
      criteria,
      onboardedDealerIds: new Set(['mc-dealer']),
      uvs: [listing({
        listingId: 'uvs-1',
        vin: '1C4RJFBG5KC123456',
        inventorySource: 'uvs',
        dealerId: 'mc-dealer',
        price: 25000,
        latitude: 35.2,
        longitude: -80.8,
      })],
      marketcheck: [listing({
        listingId: 'mc-1',
        vin: '1c4rjfbg5kc123456',
        inventorySource: 'marketcheck',
        dealerId: 'other',
        price: 24000,
        latitude: 35.2,
        longitude: -80.8,
      })],
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.listingId).toBe('uvs-1');
    expect(result.listings[0]?.drevvyDealer).toBe(true);
    expect(result.stats.dedupedCount).toBe(1);
  });

  it('does not rank an onboarded dealer above a clearly better match', () => {
    const result = mergeAndRank({
      inventoryMode: 'hybrid',
      limit: 10,
      criteria,
      onboardedDealerIds: new Set(['drevvy']),
      uvs: [],
      marketcheck: [
        listing({
          listingId: 'irrelevant',
          vin: 'VINIRRELEVANT0001',
          inventorySource: 'marketcheck',
          dealerId: 'drevvy',
          make: 'Honda',
          model: 'Civic',
          price: 15000,
          latitude: 35.2,
          longitude: -80.8,
        }),
        listing({
          listingId: 'match',
          vin: 'VINMATCH000000001',
          inventorySource: 'marketcheck',
          dealerId: 'other',
          price: 26900,
          latitude: 35.3,
          longitude: -80.9,
        }),
      ],
    });

    expect(result.listings.map((item) => item.listingId)).toEqual(['match']);
  });

  it('boosts an onboarded dealer only among similar matches', () => {
    const result = mergeAndRank({
      inventoryMode: 'hybrid',
      limit: 10,
      criteria,
      onboardedDealerIds: new Set(['drevvy']),
      uvs: [],
      marketcheck: [
        listing({
          listingId: 'independent',
          vin: 'VININDIE000000001',
          inventorySource: 'marketcheck',
          dealerId: 'other',
          price: 26500,
          mileage: 50000,
          daysOnMarket: 40,
          latitude: 35.22,
          longitude: -80.84,
        }),
        listing({
          listingId: 'drevvy',
          vin: 'VINDREVVY00000001',
          inventorySource: 'marketcheck',
          dealerId: 'drevvy',
          price: 26500,
          mileage: 50000,
          daysOnMarket: 40,
          latitude: 35.22,
          longitude: -80.84,
        }),
      ],
    });

    expect(result.listings[0]?.listingId).toBe('drevvy');
  });
});

describe('search events', () => {
  it('omits contact fields from the envelope', () => {
    const started = buildSearchStartedEvent({
      sessionId: 'sess-1',
      source: 'mcp',
      inventoryMode: 'hybrid',
      criteria: { make: 'Jeep' },
      eventId: 'evt-start',
      now: new Date('2026-09-24T12:00:00.000Z'),
    });
    const events = buildSearchEvents({
      sessionId: 'sess-1',
      source: 'consumer_ios',
      inventoryMode: 'hybrid',
      criteria: { make: 'Jeep', email: 'shopper@example.com' } as never,
      stats: {
        inventoryMode: 'hybrid',
        uvsCount: 1,
        marketcheckCount: 1,
        dedupedCount: 0,
        drevvyDealerCount: 0,
        returnedCount: 1,
      },
      listings: [listing({ listingId: 'uvs-1', vin: 'VIN123', inventorySource: 'uvs', price: 25000 })],
      now: new Date('2026-09-24T12:00:00.000Z'),
      eventId: (name, index) => `${name}-${index}`,
    });

    expect(started.event_name).toBe('search_started');
    expect(started.properties).not.toHaveProperty('email');
    expect(events.map((event) => event.event_name)).toEqual(['search_completed', 'inventory_impression']);
    expect(JSON.stringify(events)).not.toContain('shopper@example.com');
    expect(events[1]?.listing_id).toBe('uvs-1');
    expect(events[1]?.consumer_user_id).toBeNull();
  });
});

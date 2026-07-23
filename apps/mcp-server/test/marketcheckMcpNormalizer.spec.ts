import { describe, expect, it } from 'vitest';
import fixture from './fixtures/marketcheck-search-active-cars.json';
import { normalizeMarketcheckSearchResult } from '../src/services/marketcheckMcpNormalizer.js';

describe('MarketCheck MCP normalizer', () => {
  it('maps official structuredContent to the widget UVS shape', () => {
    const result = normalizeMarketcheckSearchResult(fixture);
    expect(result.totalCount).toBe(245);
    expect(result.rejectedCount).toBe(0);
    expect(result.vehicles).toHaveLength(1);
    const vehicle = result.vehicles[0];
    expect(vehicle.baseIdentity).toMatchObject({
      vin: '1HGCM82633A123456',
      year: 2024,
      make: 'Honda',
      model: 'Accord',
      trim: 'EX',
    });
    expect(vehicle.pricing).toMatchObject({ price: 28995, msrp: 31000 });
    expect(vehicle.media?.photoUrls).toHaveLength(2);
    expect(vehicle.location.dealer).toMatchObject({
      dealerId: 'dealer-1',
      name: 'Example Honda',
      city: 'Charlotte',
      state: 'NC',
      latitude: 35.2271,
      longitude: -80.8431,
    });
  });

  it('rejects listings without a usable price', () => {
    const invalid = structuredClone(fixture);
    delete (invalid.structuredContent.data.listings[0] as { price?: number }).price;
    const result = normalizeMarketcheckSearchResult(invalid);
    expect(result.vehicles).toHaveLength(0);
    expect(result.rejectedCount).toBe(1);
  });
});

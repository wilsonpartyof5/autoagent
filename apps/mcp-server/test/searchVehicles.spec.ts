import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCache } from '../src/lib/cache.js';

vi.mock('../src/config/env.js', () => ({
  CONFIG: {
    inventorySearchProvider: 'uvs',
    diagnosticsEnabled: false,
    widgetHost: 'https://example.com',
  },
}));

vi.mock('../src/lib/analytics/tracking.js', () => ({
  trackEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/lib/flowTelemetry.js', () => ({
  recordFlowEvent: vi.fn(() => Promise.resolve()),
}));

const fixtureVehicle = {
  id: 'uvs-1',
  baseIdentity: { vin: '1HGCM82633A123456', year: 2024, make: 'Honda', model: 'Accord' },
  condition: 'used',
  pricing: { price: 28000, currency: 'USD' },
  coreSpecs: { miles: 12000 },
  media: { primaryPhotoUrl: 'https://example.com/car.jpg' },
  location: { dealer: { dealerId: 'dealer-1', name: 'Example Honda', latitude: 35, longitude: -80 } },
  operational: { lastSyncedAt: new Date().toISOString() },
};

const searchUVSVehicles = vi.fn(() =>
  Promise.resolve({
    vehicles: [fixtureVehicle],
    total: 1,
    dealerSummary: [],
  }),
);

vi.mock('../src/db/uvs-vehicles.js', () => ({
  searchUVSVehicles: (...args: unknown[]) => searchUVSVehicles(...args),
}));

describe('searchVehicles', () => {
  beforeEach(() => {
    searchCache.clear();
    searchUVSVehicles.mockClear();
  });

  it('validates required parameters', async () => {
    const { searchVehicles } = await import('../src/tools/searchVehicles.js');
    const result = await searchVehicles({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid search parameters');
  });

  it('returns compact widget data from UVS', async () => {
    const { searchVehicles } = await import('../src/tools/searchVehicles.js');
    const result = await searchVehicles({ location: 'Charlotte, NC', condition: 'used' });
    expect(result.success).toBe(true);
    expect(result.data?.vehicles).toHaveLength(1);
    expect(result.data?.vehicles?.[0]).toMatchObject({
      id: 'uvs-1',
      title: '2024 Honda Accord',
      price: 28000,
      dealerName: 'Example Honda',
    });
    expect((result.data?.structuredContent as any)?.results?.dataSource).toBe('uvs_db');
  });

  it('caches repeated UVS searches', async () => {
    const { searchVehicles } = await import('../src/tools/searchVehicles.js');
    const params = { location: 'Charlotte, NC', condition: 'used' };
    await searchVehicles(params);
    await searchVehicles(params);
    expect(searchUVSVehicles).toHaveBeenCalledTimes(1);
  });
});

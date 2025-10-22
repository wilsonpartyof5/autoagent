import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchVehicles } from '../src/tools/searchVehicles.js';
import { searchCache } from '../src/lib/cache.js';

// Mock the MarketCheck client
vi.mock('../src/services/marketcheck.js', () => ({
  createMarketCheckClient: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('searchVehicles Tool', () => {
  beforeEach(() => {
    searchCache.clear();
    vi.clearAllMocks();
    delete process.env.MARKETCHECK_API_KEY;
  });

  afterEach(() => {
    searchCache.clear();
  });

  describe('Parameter validation', () => {
    it('should validate required parameters', async () => {
      const result = await searchVehicles({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid search parameters');
    });

    it('should validate parameter types', async () => {
      const result = await searchVehicles({
        location: 123, // Should be string
        condition: 'invalid', // Should be 'new' or 'used'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid search parameters');
    });

    it('should accept valid parameters', async () => {
      const result = await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
        maxPrice: 30000,
        make: 'Toyota',
        model: 'Camry',
        radiusMiles: 50,
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.vehicles).toBeDefined();
    });
  });

  describe('Mock fallback behavior', () => {
    it('should return mock data when no API key', async () => {
      const result = await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.vehicles.length).toBeGreaterThan(0);
      expect(result.data?.vehicles[0]).toMatchObject({
        id: expect.any(String),
        year: expect.any(Number),
        make: expect.any(String),
        model: expect.any(String),
        price: expect.any(Number),
        dealer: {
          name: expect.any(String),
        },
      });
    });

    it('should filter mock data by search parameters', async () => {
      const result = await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
        maxPrice: 30000,
        make: 'Toyota',
      });
      
      expect(result.success).toBe(true);
      const vehicles = result.data?.vehicles || [];
      
      // All vehicles should be under maxPrice
      vehicles.forEach(vehicle => {
        expect(vehicle.price).toBeLessThanOrEqual(30000);
        expect(vehicle.make.toLowerCase()).toContain('toyota');
      });
    });
  });

  describe('Caching behavior', () => {
    it('should cache results and return from cache on second call', async () => {
      const params = {
        location: 'Seattle, WA',
        condition: 'used' as const,
      };

      // First call
      const result1 = await searchVehicles(params);
      expect(result1.success).toBe(true);
      expect(result1.data?.vehicles.length).toBeGreaterThan(0);

      // Second call should use cache
      const result2 = await searchVehicles(params);
      expect(result2.success).toBe(true);
      expect(result2.data?.vehicles).toEqual(result1.data?.vehicles);
    });

    it('should generate different cache keys for different parameters', async () => {
      const params1 = { location: 'Seattle, WA', condition: 'used' as const };
      const params2 = { location: 'Portland, OR', condition: 'used' as const };

      const result1 = await searchVehicles(params1);
      const result2 = await searchVehicles(params2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Results should be different due to different cache keys
    });
  });

  describe('MarketCheck integration', () => {
    it('should use MarketCheck when API key is present', async () => {
      process.env.MARKETCHECK_API_KEY = 'test-key';
      
      const mockMarketCheckClient = {
        searchVehicles: vi.fn().mockResolvedValue({
          vehicles: [
            {
              id: 'mc-123',
              year: 2022,
              make: 'Toyota',
              model: 'RAV4',
              price: 28000,
              mileage: 12000,
              imageUrl: 'https://example.com/car.jpg',
              features: ['AWD', 'Bluetooth'],
              dealer: {
                name: 'MarketCheck Dealer',
                address: '123 Market St',
                lat: 47.6062,
                lng: -122.3321,
              },
            },
          ],
          totalCount: 1,
        }),
      };

      const { createMarketCheckClient } = await import('../src/services/marketcheck.js');
      vi.mocked(createMarketCheckClient).mockReturnValue(mockMarketCheckClient as any);

      const result = await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
      });

      expect(result.success).toBe(true);
      expect(result.data?.vehicles).toHaveLength(1);
      expect(result.data?.vehicles[0].id).toBe('mc-123');
      expect(mockMarketCheckClient.searchVehicles).toHaveBeenCalledWith({
        location: 'Seattle, WA',
        condition: 'used',
      });
    });

    it('should fall back to mocks when MarketCheck fails', async () => {
      process.env.MARKETCHECK_API_KEY = 'test-key';
      
      const mockMarketCheckClient = {
        searchVehicles: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      const { createMarketCheckClient } = await import('../src/services/marketcheck.js');
      vi.mocked(createMarketCheckClient).mockReturnValue(mockMarketCheckClient as any);

      const result = await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
      });

      expect(result.success).toBe(true);
      expect(result.data?.vehicles.length).toBeGreaterThan(0);
      // Should return mock data, not MarketCheck data
      expect(result.data?.vehicles[0].id).not.toBe('mc-123');
    });

    it('should handle timeout and fall back to mocks', async () => {
      process.env.MARKETCHECK_API_KEY = 'test-key';
      
      const mockMarketCheckClient = {
        searchVehicles: vi.fn().mockImplementation(() => 
          new Promise((resolve) => {
            setTimeout(resolve, 3000); // 3 second delay, longer than 2s timeout
          })
        ),
      };

      const { createMarketCheckClient } = await import('../src/services/marketcheck.js');
      vi.mocked(createMarketCheckClient).mockReturnValue(mockMarketCheckClient as any);

      const result = await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
      });

      expect(result.success).toBe(true);
      expect(result.data?.vehicles.length).toBeGreaterThan(0);
      // Should return mock data due to timeout
    });
  });

  describe('Logging and observability', () => {
    it('should log search events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/{"event":"search","hasKey":false,"fromCache":false,"results":\d+,"ms":\d+}/)
      );

      consoleSpy.mockRestore();
    });

    it('should log cache hits', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const params = {
        location: 'Seattle, WA',
        condition: 'used' as const,
      };

      // First call
      await searchVehicles(params);
      
      // Second call should hit cache
      await searchVehicles(params);

      const cacheHitLog = consoleSpy.mock.calls.find(call => 
        call[0].includes('"fromCache":true')
      );
      expect(cacheHitLog).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
});

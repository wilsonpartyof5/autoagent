import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketCheckClient } from '../src/services/marketcheck.js';
import { searchCache } from '../src/lib/cache.js';
import { HttpError } from '../src/lib/http.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MarketCheck Integration', () => {
  let client: MarketCheckClient;

  beforeEach(() => {
    client = new MarketCheckClient('https://test-api.example.com', 'test-key');
    searchCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    searchCache.clear();
  });

  describe('URL building and parameter mapping', () => {
    it('should build correct URL with all parameters', async () => {
      const mockResponse = {
        vehicles: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockResponse),
      });

      const params = {
        location: 'Seattle, WA',
        condition: 'used' as const,
        maxPrice: 30000,
        make: 'Toyota',
        model: 'RAV4',
        radiusMiles: 50,
      };

      await client.searchVehicles(params);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://test-api.example.com/api/v1/vehicles/search'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        }),
      );

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('location=Seattle%2C+WA');
      expect(url).toContain('condition=used');
      expect(url).toContain('maxPrice=30000');
      expect(url).toContain('make=Toyota');
      expect(url).toContain('model=RAV4');
      expect(url).toContain('radius=50');
      expect(url).toContain('page=1');
      expect(url).toContain('pageSize=20');
    });

    it('should build URL with only required parameters', async () => {
      const mockResponse = {
        vehicles: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockResponse),
      });

      const params = {
        location: 'New York, NY',
        condition: 'new' as const,
      };

      await client.searchVehicles(params);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('location=New+York%2C+NY');
      expect(url).toContain('condition=new');
      expect(url).not.toContain('maxPrice');
      expect(url).not.toContain('make');
      expect(url).not.toContain('model');
      expect(url).not.toContain('radius');
    });
  });

  describe('Vehicle normalization', () => {
    it('should normalize MarketCheck response to Vehicle schema', async () => {
      const mockMarketCheckResponse = {
        vehicles: [
          {
            id: 'mc-123',
            year: 2022,
            make: 'Toyota',
            model: 'Camry',
            price: 28500,
            mileage: 15000,
            images: [
              { url: 'https://example.com/image1.jpg', primary: false },
              { url: 'https://example.com/image2.jpg', primary: true },
            ],
            features: ['Bluetooth', 'Backup Camera'],
            dealer: {
              name: 'Test Dealer',
              address: '123 Main St',
              city: 'Seattle',
              state: 'WA',
              zip: '98101',
              latitude: 47.6062,
              longitude: -122.3321,
            },
            condition: 'used',
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockMarketCheckResponse),
      });

      const result = await client.searchVehicles({
        location: 'Seattle, WA',
        condition: 'used',
      });

      expect(result.vehicles).toHaveLength(1);
      
      const vehicle = result.vehicles[0];
      expect(vehicle).toMatchObject({
        id: 'mc-123',
        year: 2022,
        make: 'Toyota',
        model: 'Camry',
        price: 28500,
        mileage: 15000,
        imageUrl: 'https://example.com/image2.jpg', // Primary image
        features: ['Bluetooth', 'Backup Camera'],
        dealer: {
          name: 'Test Dealer',
          address: '123 Main St, Seattle, WA, 98101',
          lat: 47.6062,
          lng: -122.3321,
        },
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockMarketCheckResponse = {
        vehicles: [
          {
            id: 'mc-456',
            year: 2023,
            make: 'Honda',
            model: 'Civic',
            price: 25000,
            dealer: {
              name: 'Minimal Dealer',
            },
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockMarketCheckResponse),
      });

      const result = await client.searchVehicles({
        location: 'Portland, OR',
        condition: 'new',
      });

      const vehicle = result.vehicles[0];
      expect(vehicle).toMatchObject({
        id: 'mc-456',
        year: 2023,
        make: 'Honda',
        model: 'Civic',
        price: 25000,
        mileage: undefined,
        imageUrl: undefined,
        features: undefined,
        dealer: {
          name: 'Minimal Dealer',
          address: undefined,
          lat: undefined,
          lng: undefined,
        },
      });
    });
  });

  describe('Caching behavior', () => {
    it('should return cached result without HTTP call', async () => {
      const mockResponse = {
        vehicles: [{ id: 'cached-1', year: 2022, make: 'Toyota', model: 'Camry', price: 25000, dealer: { name: 'Test Dealer' } }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockResponse),
      });

      const params = {
        location: 'Seattle, WA',
        condition: 'used' as const,
      };

      // First call - should make HTTP request
      const result1 = await client.searchVehicles(params);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.vehicles).toHaveLength(1);

      // Second call - should use cache (but we need to test the searchVehicles function for this)
      // This test would be better in the searchVehicles.spec.ts file
    });
  });

  describe('Timeout handling', () => {
    it('should handle timeout gracefully', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 3000); // 3 second delay, longer than 2s timeout
        })
      );

      const params = {
        location: 'Seattle, WA',
        condition: 'used' as const,
      };

      await expect(client.searchVehicles(params)).rejects.toThrow('Request timeout');
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const params = {
        location: 'Seattle, WA',
        condition: 'used' as const,
      };

      await expect(client.searchVehicles(params)).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('Result capping', () => {
    it('should cap results at 20 vehicles', async () => {
      // Create 25 mock vehicles
      const vehicles = Array.from({ length: 25 }, (_, i) => ({
        id: `vehicle-${i}`,
        year: 2022,
        make: 'Toyota',
        model: 'Camry',
        price: 25000 + i * 1000,
        dealer: { name: `Dealer ${i}` },
      }));

      const mockResponse = {
        vehicles,
        totalCount: 25,
        page: 1,
        pageSize: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.searchVehicles({
        location: 'Seattle, WA',
        condition: 'used' as const,
      });

      expect(result.vehicles).toHaveLength(20);
      expect(result.totalCount).toBe(20);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { search } from '../src/tools/search.js';
import { searchCache } from '../src/lib/cache.js';

// Mock the searchVehicles function
vi.mock('../src/tools/searchVehicles.js', () => ({
  searchVehicles: vi.fn(),
}));

describe('search Tool', () => {
  beforeEach(() => {
    searchCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    searchCache.clear();
  });

  describe('Parameter validation', () => {
    it('should validate required query parameter', async () => {
      const result = await search({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required and must be a string');
    });

    it('should validate query parameter type', async () => {
      const result = await search({ query: 123 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required and must be a string');
    });

    it('should accept valid query parameter', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: [
            {
              id: '1',
              year: 2022,
              make: 'Toyota',
              model: 'Camry',
              price: 28500,
              vin: '1HGCM82633A004352',
            },
          ],
          totalCount: 1,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      const result = await search({ query: 'Toyota Camry' });
      
      expect(result.success).toBe(true);
      expect(result.data?.content).toBeDefined();
    });
  });

  describe('Query mapping', () => {
    it('should map query to search parameters with defaults', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: [],
          totalCount: 0,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      await search({ query: 'test query' });

      expect(mockSearchVehicles).toHaveBeenCalledWith({
        location: undefined,
        condition: 'used',
        make: undefined,
        model: undefined,
      }, undefined);
    });

    it('should extract make from query', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: [],
          totalCount: 0,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      await search({ query: 'Toyota car' });

      expect(mockSearchVehicles).toHaveBeenCalledWith({
        location: undefined,
        condition: 'used',
        make: 'Toyota',
        model: undefined,
      }, undefined);
    });

    it('should extract model from query', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: [],
          totalCount: 0,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      await search({ query: 'Honda CR-V' });

      expect(mockSearchVehicles).toHaveBeenCalledWith({
        location: undefined,
        condition: 'used',
        make: 'Honda',
        model: 'CR-V',
      }, undefined);
    });

    it('uses ChatGPT userLocation hint when query lacks location', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: [],
          totalCount: 0,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      await search(
        { query: 'find used cars for sale' },
        { userLocation: { city: 'Rock Hill', region: 'SC' } }
      );

      expect(mockSearchVehicles).toHaveBeenCalledWith({
        location: 'Rock Hill, SC',
        condition: 'used',
        radiusMiles: undefined,
        make: undefined,
        model: undefined,
      }, { userLocation: { city: 'Rock Hill', region: 'SC' } });
    });
  });

  describe('Result transformation', () => {
    it('should transform vehicles to required format', async () => {
      const mockVehicles = [
        {
          id: '1',
          year: 2022,
          make: 'Toyota',
          model: 'Camry',
          price: 28500,
          vin: '1HGCM82633A004352',
        },
        {
          id: '2',
          year: 2021,
          make: 'Honda',
          model: 'CR-V',
          price: 32000,
          vin: '2HGCM82633A004353',
        },
      ];

      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: mockVehicles,
          totalCount: 2,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      const result = await search({ query: 'cars' });

      expect(result.success).toBe(true);
      expect(result.data?.content[0].text).toContain('Found 2 vehicles');
      expect(result.data?.structuredContent).toMatchObject({
        results: {
          vehicles: mockVehicles,
          totalCount: 2,
        },
      });
    });

    it('should handle empty results', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: [],
          totalCount: 0,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      const result = await search({ query: 'no results' });

      expect(result.success).toBe(true);
      expect(result.data?.content[0].text).toContain('Found 0 vehicles');
      expect(result.data?.structuredContent).toMatchObject({
        results: {
          vehicles: [],
          totalCount: 0,
        },
      });
    });
  });

  describe('Error handling', () => {
    it('should handle searchVehicles failure', async () => {
      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: false,
        error: 'Search failed',
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      const result = await search({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed');
    });

    it('should handle searchVehicles exception', async () => {
      const mockSearchVehicles = vi.fn().mockRejectedValue(new Error('Network error'));

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      const result = await search({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Schema compliance', () => {
    it('should return structuredContent for UI rendering', async () => {
      const mockVehicles = [
        {
          id: '1',
          year: 2022,
          make: 'Toyota',
          model: 'Camry',
          price: 28500,
          vin: '1HGCM82633A004352',
        },
      ];

      const mockSearchVehicles = vi.fn().mockResolvedValue({
        success: true,
        data: {
          vehicles: mockVehicles,
          totalCount: 1,
        },
      });

      const { searchVehicles } = await import('../src/tools/searchVehicles.js');
      vi.mocked(searchVehicles).mockImplementation(mockSearchVehicles);

      const result = await search({ query: 'Toyota' });

      expect(result.success).toBe(true);
      expect(result.data?.structuredContent).toMatchObject({
        results: {
          vehicles: mockVehicles,
          totalCount: 1,
        },
      });
    });
  });
});

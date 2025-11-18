import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enrichListing,
  mergeEnrichment,
  isEnrichmentEnabled,
  type EnrichmentData,
} from '@autoagent/shared';
import type { MarketCheckVehicle } from '@autoagent/shared';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

describe('MarketCheck Enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEnrichmentEnabled', () => {
    it('should return false when flag is not set', () => {
      delete process.env.MARKETCHECK_ENRICH_LISTINGS;
      expect(isEnrichmentEnabled()).toBe(false);
    });

    it('should return false when flag is set to 0', () => {
      process.env.MARKETCHECK_ENRICH_LISTINGS = '0';
      expect(isEnrichmentEnabled()).toBe(false);
    });

    it('should return true when flag is set to 1', () => {
      process.env.MARKETCHECK_ENRICH_LISTINGS = '1';
      expect(isEnrichmentEnabled()).toBe(true);
    });

    it('should return false when flag is set to any other value', () => {
      process.env.MARKETCHECK_ENRICH_LISTINGS = 'true';
      expect(isEnrichmentEnabled()).toBe(false);
    });
  });

  describe('enrichListing', () => {
    const baseUrl = 'https://test-api.example.com';
    const apiKey = 'test-key';
    const listingId = 'mc-12345';
    const dealerId = 'dealer-123';

    beforeEach(() => {
      process.env.MARKETCHECK_ENRICH_LISTINGS = '1';
    });

    it('should return null when enrichment is disabled', async () => {
      process.env.MARKETCHECK_ENRICH_LISTINGS = '0';
      const result = await enrichListing(listingId, dealerId, baseUrl, apiKey);
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch all enrichment endpoints in parallel', async () => {
      const mockDetail: MarketCheckVehicle = {
        id: listingId,
        price: 30000,
        build: { year: 2022, make: 'Toyota', model: 'Camry' },
        dealer: { name: 'Test Dealer' },
      };

      const mockMedia = {
        media: {
          photo_links: ['https://example.com/photo3.jpg', 'https://example.com/photo4.jpg'],
          primary_photo_url: 'https://example.com/primary.jpg',
        },
      };

      const mockExtra = {
        features: ['Sunroof', 'Leather Seats'],
        seller_comments: 'One owner, garage kept',
      };

      const mockDealer = {
        dealer: {
          id: dealerId,
          name: 'Test Dealer',
          phone: '555-1234',
          website: 'https://testdealer.com',
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockDetail),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockMedia),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockExtra),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockDealer),
        });

      const result = await enrichListing(listingId, dealerId, baseUrl, apiKey);

      expect(result).not.toBeNull();
      expect(result?.detail).toEqual(mockDetail);
      expect(result?.media).toEqual(mockMedia.media);
      expect(result?.extra).toEqual(mockExtra);
      expect(result?.dealer).toEqual(mockDealer.dealer);

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/v2/listing/car/${listingId}?api_key=${apiKey}`,
        expect.objectContaining({ cache: 'no-store' }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/v2/listing/car/${listingId}/media?api_key=${apiKey}`,
        expect.objectContaining({ cache: 'no-store' }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/v2/listing/car/${listingId}/extra?api_key=${apiKey}`,
        expect.objectContaining({ cache: 'no-store' }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/v2/dealer/${dealerId}?api_key=${apiKey}`,
        expect.objectContaining({ cache: 'no-store' }),
      );
    });

    it('should handle partial failures gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ media: { photo_links: ['photo1.jpg'] } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ dealer: { id: dealerId, name: 'Test Dealer' } }),
        });

      const result = await enrichListing(listingId, dealerId, baseUrl, apiKey);

      expect(result).not.toBeNull();
      expect(result?.detail).toBeUndefined();
      expect(result?.media).toEqual({ photo_links: ['photo1.jpg'] });
      expect(result?.extra).toBeUndefined();
      expect(result?.dealer).toEqual({ id: dealerId, name: 'Test Dealer' });
    });

    it('should return null if all endpoints fail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const result = await enrichListing(listingId, dealerId, baseUrl, apiKey);

      expect(result).toBeNull();
    });

    it('should not fetch dealer info if dealerId is not provided', async () => {
      const mockMedia = { media: { photo_links: ['photo1.jpg'] } };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockMedia),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        });

      const result = await enrichListing(listingId, undefined, baseUrl, apiKey);

      expect(result).not.toBeNull();
      expect(result?.dealer).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(3); // No dealer call
    });
  });

  describe('mergeEnrichment', () => {
    const baseListing: MarketCheckVehicle = {
      id: 'mc-123',
      price: 25000,
      build: {
        year: 2022,
        make: 'Toyota',
        model: 'Camry',
      },
      media: {
        photo_links: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        primary_photo_url: 'https://example.com/photo1.jpg',
      },
      features: ['Bluetooth', 'Backup Camera'],
      dealer: {
        id: 'dealer-123',
        name: 'Base Dealer',
        city: 'Seattle',
      },
    };

    it('should return original listing if enrichment is null', () => {
      const result = mergeEnrichment(baseListing, null);
      expect(result).toEqual(baseListing);
    });

    it('should merge detail data', () => {
      const enrichment: EnrichmentData = {
        detail: {
          id: 'mc-123',
          price: 28000, // Updated price
          msrp: 32000, // New field
          build: {
            year: 2022,
            make: 'Toyota',
            model: 'Camry',
            trim: 'LE', // New field
          },
          dealer: {
            name: 'Base Dealer',
          },
        },
      };

      const result = mergeEnrichment(baseListing, enrichment);

      expect(result.price).toBe(28000);
      expect(result.msrp).toBe(32000);
      expect(result.build?.trim).toBe('LE');
      expect(result.id).toBe('mc-123'); // ID preserved
    });

    it('should merge and deduplicate photos', () => {
      const enrichment: EnrichmentData = {
        media: {
          photo_links: [
            'https://example.com/photo2.jpg', // Duplicate
            'https://example.com/photo3.jpg', // New
            'https://example.com/photo4.jpg', // New
          ],
          primary_photo_url: 'https://example.com/photo3.jpg',
        },
      };

      const result = mergeEnrichment(baseListing, enrichment);

      expect(result.media?.photo_links).toHaveLength(4);
      expect(result.media?.photo_links).toContain('https://example.com/photo1.jpg');
      expect(result.media?.photo_links).toContain('https://example.com/photo2.jpg');
      expect(result.media?.photo_links).toContain('https://example.com/photo3.jpg');
      expect(result.media?.photo_links).toContain('https://example.com/photo4.jpg');
      expect(result.media?.primary_photo_url).toBe('https://example.com/photo3.jpg');
    });

    it('should merge and deduplicate features', () => {
      const enrichment: EnrichmentData = {
        extra: {
          features: ['Backup Camera', 'Sunroof', 'Navigation'], // Backup Camera is duplicate
        },
      };

      const result = mergeEnrichment(baseListing, enrichment);

      expect(result.features).toHaveLength(4);
      expect(result.features).toContain('Bluetooth');
      expect(result.features).toContain('Backup Camera');
      expect(result.features).toContain('Sunroof');
      expect(result.features).toContain('Navigation');
    });

    it('should merge dealer data', () => {
      const enrichment: EnrichmentData = {
        dealer: {
          id: 'dealer-123',
          name: 'Enriched Dealer',
          phone: '555-1234',
          website: 'https://enricheddealer.com',
          rating: 4.5,
        },
      };

      const result = mergeEnrichment(baseListing, enrichment);

      expect(result.dealer?.name).toBe('Enriched Dealer');
      expect(result.dealer?.phone).toBe('555-1234');
      expect(result.dealer?.website).toBe('https://enricheddealer.com');
      expect(result.dealer?.rating).toBe(4.5);
      expect(result.dealer?.city).toBe('Seattle'); // Preserved from base
    });

    it('should preserve dealer name from base if enriched dealer has no name', () => {
      const enrichment: EnrichmentData = {
        dealer: {
          id: 'dealer-123',
          phone: '555-1234',
        },
      };

      const result = mergeEnrichment(baseListing, enrichment);

      expect(result.dealer?.name).toBe('Base Dealer');
      expect(result.dealer?.phone).toBe('555-1234');
    });

    it('should handle listing with no existing media', () => {
      const listingWithoutMedia: MarketCheckVehicle = {
        id: 'mc-456',
        price: 20000,
        build: { year: 2021, make: 'Honda', model: 'Civic' },
        dealer: { name: 'Test Dealer' },
      };

      const enrichment: EnrichmentData = {
        media: {
          photo_links: ['https://example.com/new-photo.jpg'],
          primary_photo_url: 'https://example.com/new-photo.jpg',
        },
      };

      const result = mergeEnrichment(listingWithoutMedia, enrichment);

      expect(result.media?.photo_links).toEqual(['https://example.com/new-photo.jpg']);
      expect(result.media?.primary_photo_url).toBe('https://example.com/new-photo.jpg');
    });

    it('should handle listing with no existing features', () => {
      const listingWithoutFeatures: MarketCheckVehicle = {
        id: 'mc-789',
        price: 15000,
        build: { year: 2020, make: 'Ford', model: 'Focus' },
        dealer: { name: 'Test Dealer' },
      };

      const enrichment: EnrichmentData = {
        extra: {
          features: ['New Feature 1', 'New Feature 2'],
        },
      };

      const result = mergeEnrichment(listingWithoutFeatures, enrichment);

      expect(result.features).toEqual(['New Feature 1', 'New Feature 2']);
    });
  });
});


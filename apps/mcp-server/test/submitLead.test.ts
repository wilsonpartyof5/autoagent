/**
 * Submit Lead Tool Tests (UVS-first)
 * 
 * Tests for the UVS-first lead submission tool that enforces UVS lookup
 * and validates all required fields.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitLead } from '../src/tools/submitLead.js';
import type { UnifiedVehicle } from '@autoagent/shared';

// Mock dependencies
vi.mock('../src/db/uvs-vehicles.js', () => ({
  getUVSVehicleById: vi.fn(),
  getUVSVehicleByVIN: vi.fn(),
}));

vi.mock('../src/services/forwardLead.js', () => ({
  forwardLead: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../src/services/leadDeliveryOutbox.js', () => ({
  processLeadDeliveryJobs: vi.fn(() => Promise.resolve({ processed: 0, succeeded: 0, failed: 0 })),
}));

vi.mock('../src/lib/analytics/tracking.js', () => ({
  trackEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/lib/crypto.js', () => ({
  encryptJson: vi.fn((data) => Promise.resolve(JSON.stringify(data))),
}));

import { getUVSVehicleById, getUVSVehicleByVIN } from '../src/db/uvs-vehicles.js';
import { forwardLead } from '../src/services/forwardLead.js';
import { processLeadDeliveryJobs } from '../src/services/leadDeliveryOutbox.js';
import { signSearchResult } from '../src/lib/searchResultToken.js';
import { resetLeadRateLimitForTests } from '../src/lib/leadRateLimit.js';

describe('submitLead (UVS-first)', () => {
  // Sample UVS vehicle for testing
  const mockUVSVehicle: UnifiedVehicle = {
    id: 'mc-12345', // UVS IDs are not necessarily UUIDs
    baseIdentity: {
      vin: '1HGBH41JXMN109186',
      year: 2023,
      make: 'Toyota',
      model: 'Camry',
    },
    condition: 'new',
    pricing: {
      price: 28500,
      currency: 'USD',
    },
    location: {
      dealer: {
        dealerId: 'dealer-123',
        name: 'ABC Auto Sales',
      },
    },
    operational: {
      lastSyncedAt: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetLeadRateLimitForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful submission', () => {
    it('should successfully submit a lead with full UVS payload', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-123-4567',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(true);
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent?.leadId).toBeDefined();
      expect(result.structuredContent?.vehicleId).toBe('mc-12345');
      expect(result.structuredContent?.dealerId).toBe('dealer-123');
      expect(result.structuredContent?.vin).toBe('1HGBH41JXMN109186');
      expect(result.structuredContent?.price).toBe(28500);
      expect(result.structuredContent?.currency).toBe('USD');

      // Verify UVS lookup was called
      expect(getUVSVehicleById).toHaveBeenCalledWith('mc-12345');

      // Verify lead was stored with UVS fields
      expect(forwardLead).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId: 'mc-12345',
          dealerId: 'dealer-123',
          vin: '1HGBH41JXMN109186',
        })
      );
      expect(processLeadDeliveryJobs).toHaveBeenCalled();
    });

    it('fails when dashboard persist does not succeed', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);
      vi.mocked(forwardLead).mockResolvedValueOnce(false);

      const result = await submitLead({
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: { price: 28500, currency: 'USD' },
        user: { name: 'John Doe', email: 'john.doe@example.com' },
        consent: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/save your request/i);
    });

    it('should hydrate missing dealer fields from UVS', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        // dealerId and dealerName not provided - should be hydrated from UVS
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(true);
      expect(result.structuredContent?.dealerId).toBe('dealer-123');

      // Verify lead was stored with hydrated dealer info
      expect(forwardLead).toHaveBeenCalledWith(
        expect.objectContaining({
          dealerId: 'dealer-123',
        })
      );
    });

    it('should use UVS price as source of truth when prices differ', async () => {
      const vehicleWithDifferentPrice = {
        ...mockUVSVehicle,
        pricing: {
          price: 29000, // Different from input
          currency: 'USD',
        },
      };
      vi.mocked(getUVSVehicleById).mockResolvedValue(vehicleWithDifferentPrice);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500, // Different from UVS
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(true);
      // Should use UVS price (source of truth)
      expect(result.structuredContent?.price).toBe(29000);

      expect(forwardLead).toHaveBeenCalledWith(
        expect.objectContaining({
          dealerId: 'dealer-123',
        })
      );
    });
  });

  describe('UVS lookup failures', () => {
    it('should reject submission when UVS lookup by vehicleId fails', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(null);
      vi.mocked(getUVSVehicleByVIN).mockResolvedValue(null);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vehicle not found in UVS inventory');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should fall back to VIN lookup when vehicleId lookup fails', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(null);
      vi.mocked(getUVSVehicleByVIN).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(true);
      expect(getUVSVehicleById).toHaveBeenCalled();
      expect(getUVSVehicleByVIN).toHaveBeenCalledWith('1HGBH41JXMN109186');
    });
  });

  describe('field validation against UVS', () => {
    it('should reject when VIN does not match UVS record', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: '550e8400-e29b-41d4-a716-446655440000',
        vin: '1HGCM82633A123456', // Valid but different VIN
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('VIN mismatch');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when vehicleId does not match UVS record', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'wrong-vehicle-id', // Wrong vehicleId
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vehicle ID mismatch');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when dealerId does not match UVS record', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'wrong-dealer-id', // Wrong dealerId
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dealer ID mismatch');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when dealerName does not match UVS record', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'Wrong Dealer Name', // Wrong dealerName
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dealer name mismatch');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when UVS vehicle has no VIN', async () => {
      const vehicleWithoutVIN = {
        ...mockUVSVehicle,
        baseIdentity: {
          ...mockUVSVehicle.baseIdentity,
          vin: undefined,
        },
      };
      vi.mocked(getUVSVehicleById).mockResolvedValue(vehicleWithoutVIN);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not have a VIN');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when UVS vehicle has no dealerId', async () => {
      const vehicleWithoutDealer = {
        ...mockUVSVehicle,
        location: {
          dealer: {
            name: 'ABC Auto Sales',
            // dealerId missing
          },
        },
      };
      vi.mocked(getUVSVehicleById).mockResolvedValue(vehicleWithoutDealer);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        // dealerId not provided and not in UVS
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dealer ID is required');
      expect(forwardLead).not.toHaveBeenCalled();
    });
  });

  describe('input schema validation', () => {
    it('should reject when vehicleId is missing', async () => {
      const params = {
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when vin is missing', async () => {
      const params = {
        vehicleId: '550e8400-e29b-41d4-a716-446655440000',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should hydrate dealerId when it is missing from a UVS lead', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);
      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(true);
      expect(result.structuredContent?.dealerId).toBe('dealer-123');
    });

    it('should reject when pricing is missing', async () => {
      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject when consent is false', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: false, // Invalid
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Consent must be true');
      expect(forwardLead).not.toHaveBeenCalled();
    });

    it('should reject additional non-UVS fields (strict mode)', async () => {
      const params = {
        vehicleId: 'mc-12345',
        vin: '1HGBH41JXMN109186',
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
        // Non-UVS field - should be rejected
        marketCheckListingId: 'mc-123',
      };

      const result = await submitLead(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
      expect(forwardLead).not.toHaveBeenCalled();
    });
  });

  describe('case-insensitive VIN matching', () => {
    it('should accept VIN with different case', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const params = {
        vehicleId: 'mc-12345',
        vin: '1hgbh41jxmn109186', // Lowercase
        dealerId: 'dealer-123',
        dealerName: 'ABC Auto Sales',
        pricing: {
          price: 28500,
          currency: 'USD',
        },
        user: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        consent: true,
      };

      const result = await submitLead(params);

      expect(result.success).toBe(true);
    });
  });

  describe('UVS idempotency and rate limits', () => {
    const params = {
      vehicleId: 'mc-12345',
      vin: '1HGBH41JXMN109186',
      dealerId: 'dealer-123',
      dealerName: 'ABC Auto Sales',
      pricing: { price: 28500, currency: 'USD' },
      user: { name: 'John Doe', email: 'john.doe@example.com' },
      consent: true,
    };

    it('reuses the same UVS lead id for the same vin, dealer, and email', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);

      const first = await submitLead(params);
      const second = await submitLead(params);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.structuredContent?.leadId).toBe(first.structuredContent?.leadId);
      expect(first.structuredContent?.leadId).toMatch(/^uvs_/);
    });

    it('rejects a sixth quote from the same shopper within 15 minutes', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(mockUVSVehicle);
      const ctx = { ipAddress: '203.0.113.10' };

      for (let i = 0; i < 5; i += 1) {
        const result = await submitLead({
          ...params,
          user: { ...params.user, email: `shopper${i}@example.com` },
        }, ctx);
        expect(result.success).toBe(true);
      }

      const blocked = await submitLead({
        ...params,
        user: { ...params.user, email: 'shopper5@example.com' },
      }, ctx);
      expect(blocked.success).toBe(false);
      expect(blocked.error).toMatch(/too many quote requests/i);
      expect(forwardLead).toHaveBeenCalledTimes(5);
    });
  });

  describe('MarketCheck nationwide leads', () => {
    it('accepts a signed search result and routes it to the platform inbox', async () => {
      vi.mocked(getUVSVehicleById).mockResolvedValue(null);
      vi.mocked(getUVSVehicleByVIN).mockResolvedValue(null);
      const vehicle = {
        id: 'mc-listing-1',
        baseIdentity: { vin: '1HGCM82633A123456', year: 2024, make: 'Honda', model: 'Accord' },
        pricing: { price: 28995, currency: 'USD' },
        location: { dealer: { dealerId: 'mc-dealer-1', name: 'Example Honda' } },
      };
      const searchResultToken = signSearchResult({
        listingId: vehicle.id,
        vin: vehicle.baseIdentity.vin,
        dealerId: vehicle.location.dealer.dealerId,
        dealerName: vehicle.location.dealer.name,
        price: vehicle.pricing.price,
        currency: 'USD',
        provider: 'marketcheck_mcp',
        flowId: 'flow-1',
        vehicle,
      });

      const result = await submitLead({
        vehicleId: vehicle.id,
        vin: vehicle.baseIdentity.vin,
        dealerId: vehicle.location.dealer.dealerId,
        dealerName: vehicle.location.dealer.name,
        pricing: vehicle.pricing,
        user: { name: 'Jane Doe', email: 'jane@example.com' },
        consent: true,
        searchResultToken,
      });

      expect(result.success).toBe(true);
      const retryResult = await submitLead({
        vehicleId: vehicle.id,
        vin: vehicle.baseIdentity.vin,
        dealerId: vehicle.location.dealer.dealerId,
        dealerName: vehicle.location.dealer.name,
        pricing: vehicle.pricing,
        user: { name: 'Jane Doe', email: 'jane@example.com' },
        consent: true,
        searchResultToken,
      });
      expect(retryResult.structuredContent?.leadId).toBe(result.structuredContent?.leadId);
      expect(forwardLead).toHaveBeenCalledWith(expect.objectContaining({
        inventorySource: 'marketcheck_mcp',
        routingStatus: 'platform_inbox',
        flowId: 'flow-1',
        vehicleSnapshot: vehicle,
      }));
      expect(processLeadDeliveryJobs).not.toHaveBeenCalled();
    });
  });
});


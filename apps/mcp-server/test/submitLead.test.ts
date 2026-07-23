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

vi.mock('../src/data/db.js', () => ({
  insertLead: vi.fn(),
}));

vi.mock('../src/services/forwardLead.js', () => ({
  forwardLead: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/services/deliverLead.js', () => ({
  deliverLead: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/lib/analytics/tracking.js', () => ({
  trackEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/lib/crypto.js', () => ({
  encryptJson: vi.fn((data) => Promise.resolve(JSON.stringify(data))),
}));

import { getUVSVehicleById, getUVSVehicleByVIN } from '../src/db/uvs-vehicles.js';
import { insertLead } from '../src/data/db.js';

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
      expect(insertLead).toHaveBeenCalledWith(
        expect.objectContaining({
          uvsVehicleId: 'mc-12345',
          uvsDealerId: 'dealer-123',
          vehicleId: 'mc-12345',
          dealerId: 'dealer-123',
          vin: '1HGBH41JXMN109186',
          price: 28500,
          currency: 'USD',
        })
      );
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
      expect(insertLead).toHaveBeenCalledWith(
        expect.objectContaining({
          uvsDealerId: 'dealer-123',
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

      expect(insertLead).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 29000, // UVS price, not input price
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
      expect(insertLead).not.toHaveBeenCalled();
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
});


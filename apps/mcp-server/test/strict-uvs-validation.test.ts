/**
 * Strict UVS Validation Tests
 * 
 * Tests for strict validation of provider-normalized UVS payloads.
 * 
 * These tests verify:
 * - Required blocks: baseIdentity, pricing, location, operational
 * - Enums: fuelType, drivetrain, transmission.type, odometer unit ("mi"/"km")
 * - Valid ranges/types (e.g., year, price ≥ 0)
 * - Invalid payloads are rejected and not written to UVS
 * 
 * Run tests with: pnpm test strict-uvs-validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateStrictUVS } from '@autoagent/shared';
import type { UnifiedVehicle } from '@autoagent/shared';

describe('Strict UVS Validation', () => {
  /**
   * Helper to create a minimal valid UVS payload
   */
  function createMinimalValidPayload(): UnifiedVehicle {
    return {
      id: 'test-vehicle-1',
      baseIdentity: {
        year: 2023,
        make: 'Toyota',
        model: 'Camry',
      },
      condition: 'new',
      pricing: {
        price: 28000,
      },
      location: {
        dealer: {
          name: 'Test Dealer',
        },
      },
      operational: {
        lastSyncedAt: new Date().toISOString(),
      },
    };
  }

  describe('Valid Payloads', () => {
    it('should validate a minimal valid UVS payload with all required blocks', () => {
      const payload = createMinimalValidPayload();
      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
      expect(result.errorDetails).toBeUndefined();
    });

    it('should validate a fully populated UVS payload with all enums', () => {
      const payload: UnifiedVehicle = {
        id: 'test-vehicle-2',
        baseIdentity: {
          vin: '1HGBH41JXMN109186',
          year: 2022,
          make: 'Honda',
          model: 'Accord',
          trim: 'EX-L',
          stockNumber: 'STK-12345',
          listingId: 'mc-abc123',
          vehicleType: 'car',
        },
        condition: 'used',
        coreSpecs: {
          bodyType: 'Sedan',
          fuelType: 'gasoline',
          engine: {
            description: '2.0L Turbo I4',
            displacement: 2.0,
            cylinders: 4,
            horsepower: 252,
          },
          transmission: {
            description: '10-Speed Automatic',
            type: 'automatic',
          },
          drivetrain: 'fwd',
          odometer: {
            value: 15000,
            unit: 'mi',
          },
        },
        pricing: {
          price: 28500,
          msrp: 32000,
          currency: 'USD',
        },
        location: {
          dealer: {
            dealerId: 'dealer-123',
            name: 'Honda of Seattle',
            city: 'Seattle',
            state: 'WA',
          },
        },
        operational: {
          dataSource: 'marketcheck-api',
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'success',
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate payload with odometer in kilometers', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-3',
        coreSpecs: {
          odometer: {
            value: 24140, // 15000 miles in km
            unit: 'km',
          },
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate payload with all fuel type enums', () => {
      const fuelTypes = [
        'gasoline',
        'diesel',
        'electric',
        'hybrid',
        'plug-in hybrid',
        'flex fuel',
        'natural gas',
        'hydrogen',
        'other',
      ] as const;

      for (const fuelType of fuelTypes) {
        const payload: UnifiedVehicle = {
          ...createMinimalValidPayload(),
          id: `test-vehicle-fuel-${fuelType}`,
          coreSpecs: {
            fuelType,
          },
        };

        const result = validateStrictUVS(payload);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
      }
    });

    it('should validate payload with all drivetrain enums', () => {
      const drivetrains = ['fwd', 'rwd', 'awd', '4wd', 'part-time 4wd'] as const;

      for (const drivetrain of drivetrains) {
        const payload: UnifiedVehicle = {
          ...createMinimalValidPayload(),
          id: `test-vehicle-drivetrain-${drivetrain}`,
          coreSpecs: {
            drivetrain,
          },
        };

        const result = validateStrictUVS(payload);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
      }
    });

    it('should validate payload with all transmission type enums', () => {
      const transmissionTypes = [
        'automatic',
        'manual',
        'cvt',
        'dual clutch',
        'automated manual',
      ] as const;

      for (const type of transmissionTypes) {
        const payload: UnifiedVehicle = {
          ...createMinimalValidPayload(),
          id: `test-vehicle-transmission-${type}`,
          coreSpecs: {
            transmission: {
              type,
            },
          },
        };

        const result = validateStrictUVS(payload);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
      }
    });
  });

  describe('Required Blocks Validation', () => {
    it('should reject payload missing baseIdentity', () => {
      const payload = {
        id: 'test-vehicle-invalid-1',
        condition: 'new',
        pricing: { price: 28000 },
        location: { dealer: { name: 'Test Dealer' } },
        operational: { lastSyncedAt: new Date().toISOString() },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.some((e) => e.path.includes('baseIdentity'))).toBe(true);
    });

    it('should reject payload missing pricing', () => {
      const payload = {
        id: 'test-vehicle-invalid-2',
        baseIdentity: { year: 2023, make: 'Toyota', model: 'Camry' },
        condition: 'new',
        location: { dealer: { name: 'Test Dealer' } },
        operational: { lastSyncedAt: new Date().toISOString() },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.some((e) => e.path.includes('pricing'))).toBe(true);
    });

    it('should reject payload missing location', () => {
      const payload = {
        id: 'test-vehicle-invalid-3',
        baseIdentity: { year: 2023, make: 'Toyota', model: 'Camry' },
        condition: 'new',
        pricing: { price: 28000 },
        operational: { lastSyncedAt: new Date().toISOString() },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.some((e) => e.path.includes('location'))).toBe(true);
    });

    it('should reject payload missing operational', () => {
      const payload = {
        id: 'test-vehicle-invalid-4',
        baseIdentity: { year: 2023, make: 'Toyota', model: 'Camry' },
        condition: 'new',
        pricing: { price: 28000 },
        location: { dealer: { name: 'Test Dealer' } },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.some((e) => e.path.includes('operational'))).toBe(true);
    });

    it('should reject payload with missing required fields in baseIdentity', () => {
      const payload = {
        id: 'test-vehicle-invalid-5',
        baseIdentity: {
          // Missing year, make, model
        },
        condition: 'new',
        pricing: { price: 28000 },
        location: { dealer: { name: 'Test Dealer' } },
        operational: { lastSyncedAt: new Date().toISOString() },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) =>
            e.path.includes('year') ||
            e.path.includes('make') ||
            e.path.includes('model')
        )
      ).toBe(true);
    });

    it('should reject payload with missing dealer name in location', () => {
      const payload = {
        id: 'test-vehicle-invalid-6',
        baseIdentity: { year: 2023, make: 'Toyota', model: 'Camry' },
        condition: 'new',
        pricing: { price: 28000 },
        location: {
          dealer: {
            // Missing required name
            city: 'Seattle',
          },
        },
        operational: { lastSyncedAt: new Date().toISOString() },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails?.some((e) => e.path.includes('name'))).toBe(true);
    });
  });

  describe('Enum Validation', () => {
    it('should reject invalid fuelType enum', () => {
      const payload: any = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-fuel',
        coreSpecs: {
          fuelType: 'invalid-fuel-type',
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('fuelType') && e.message.includes('enum')
        )
      ).toBe(true);
    });

    it('should reject invalid drivetrain enum', () => {
      const payload: any = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-drivetrain',
        coreSpecs: {
          drivetrain: 'invalid-drivetrain',
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('drivetrain') && e.message.includes('enum')
        )
      ).toBe(true);
    });

    it('should reject invalid transmission.type enum', () => {
      const payload: any = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-transmission',
        coreSpecs: {
          transmission: {
            type: 'invalid-transmission-type',
          },
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) =>
            e.path.includes('transmission') &&
            e.path.includes('type') &&
            e.message.includes('enum')
        )
      ).toBe(true);
    });

    it('should reject invalid odometer unit (not "mi" or "km")', () => {
      const payload: any = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-odometer-unit',
        coreSpecs: {
          odometer: {
            value: 15000,
            unit: 'miles', // Invalid - must be "mi" or "km"
          },
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) =>
            e.path.includes('odometer') &&
            e.path.includes('unit') &&
            (e.message.includes('mi') || e.message.includes('km'))
        )
      ).toBe(true);
    });

    it('should reject invalid condition enum', () => {
      const payload: any = {
        ...createMinimalValidPayload(),
        condition: 'invalid-condition',
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('condition') && e.message.includes('enum')
        )
      ).toBe(true);
    });
  });

  describe('Range and Type Validation', () => {
    it('should reject year below minimum (1900)', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-year-low',
        baseIdentity: {
          year: 1800, // Below minimum
          make: 'Toyota',
          model: 'Camry',
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('year') && e.message.includes('1900')
        )
      ).toBe(true);
    });

    it('should reject year above maximum (2100)', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-year-high',
        baseIdentity: {
          year: 2200, // Above maximum
          make: 'Toyota',
          model: 'Camry',
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('year') && e.message.includes('2100')
        )
      ).toBe(true);
    });

    it('should reject negative price', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-price',
        pricing: {
          price: -1000, // Negative price
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('price') && e.message.includes('0')
        )
      ).toBe(true);
    });

    it('should reject negative odometer value', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-invalid-odometer-value',
        coreSpecs: {
          odometer: {
            value: -1000, // Negative value
            unit: 'mi',
          },
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) => e.path.includes('odometer') && e.message.includes('0')
        )
      ).toBe(true);
    });

    it('should reject invalid lastSyncedAt format (not ISO 8601)', () => {
      const payload: any = {
        ...createMinimalValidPayload(),
        operational: {
          lastSyncedAt: 'invalid-date', // Not ISO 8601
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(
        result.errorDetails?.some(
          (e) =>
            e.path.includes('lastSyncedAt') &&
            e.message.includes('datetime')
        )
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null gracefully', () => {
      const result = validateStrictUVS(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle undefined gracefully', () => {
      const result = validateStrictUVS(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle empty object', () => {
      const result = validateStrictUVS({});

      expect(result.valid).toBe(false);
      expect(result.errorDetails).toBeDefined();
    });

    it('should validate with zero price (edge case)', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-zero-price',
        pricing: {
          price: 0, // Zero is valid (>= 0)
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate with zero odometer value (edge case)', () => {
      const payload: UnifiedVehicle = {
        ...createMinimalValidPayload(),
        id: 'test-vehicle-zero-odometer',
        coreSpecs: {
          odometer: {
            value: 0, // Zero is valid (>= 0)
            unit: 'mi',
          },
        },
      };

      const result = validateStrictUVS(payload);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});


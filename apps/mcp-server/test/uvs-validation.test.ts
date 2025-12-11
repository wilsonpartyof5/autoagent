/**
 * UVS Validation Tests
 * 
 * Tests for validating vehicle data against the Unified Vehicle Schema (UVS).
 */

import { describe, it, expect } from 'vitest';
import { validateUVS } from '../src/validation/validateUVS.js';
import type { UVS } from '../src/types/UVS.js';

describe('UVS Validation', () => {
  describe('valid payloads', () => {
    it('should validate a minimal valid UVS payload', () => {
      const validPayload: UVS = {
        id: 'test-vehicle-1',
        baseIdentity: {
          year: 2023,
          make: 'Toyota',
          model: 'Camry',
        },
        condition: 'new',
        pricing: {
          price: 28000,
          currency: 'USD',
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

      const result = validateUVS(validPayload);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should validate a fully populated UVS payload', () => {
      const fullPayload: UVS = {
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
        featuresPackages: {
          features: [
            {
              name: 'Bluetooth',
              category: 'technology',
              description: 'Bluetooth connectivity',
            },
            {
              name: 'Backup Camera',
              category: 'safety',
            },
          ],
          packages: [
            {
              name: 'Technology Package',
              code: 'TECH',
              price: 2000,
              description: 'Advanced tech features',
            },
          ],
        },
        media: {
          primaryPhotoUrl: 'https://example.com/photo1.jpg',
          photoUrls: [
            'https://example.com/photo1.jpg',
            'https://example.com/photo2.jpg',
          ],
        },
        location: {
          dealer: {
            dealerId: 'dealer-123',
            name: 'Honda of Seattle',
            city: 'Seattle',
            state: 'WA',
          },
        },
        availability: {
          status: 'available',
        },
        marketData: {
          averageDaysOnMarket: 45,
        },
        operational: {
          dataSource: 'marketcheck-api',
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'success',
        },
        dealerDefined: {
          customField1: 'value1',
          priority: 1,
        },
        enrichment: {
          aiGenerated: {
            description: 'AI-generated description',
          },
        },
      };

      const result = validateUVS(fullPayload);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });
  });

  describe('invalid payloads', () => {
    it('should reject payload missing required fields', () => {
      const invalidPayload = {
        id: 'test-vehicle-3',
        // Missing baseIdentity, condition, pricing, location, operational
      };

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it('should reject payload with invalid baseIdentity', () => {
      const invalidPayload = {
        id: 'test-vehicle-4',
        baseIdentity: {
          // Missing required year, make, model
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with invalid condition', () => {
      const invalidPayload = {
        id: 'test-vehicle-5',
        baseIdentity: {
          year: 2023,
          make: 'Toyota',
          model: 'Camry',
        },
        condition: 'invalid-condition', // Invalid enum value
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with invalid VIN pattern', () => {
      const invalidPayload = {
        id: 'test-vehicle-6',
        baseIdentity: {
          vin: 'INVALID-VIN', // Invalid VIN pattern
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with missing price', () => {
      const invalidPayload = {
        id: 'test-vehicle-7',
        baseIdentity: {
          year: 2023,
          make: 'Toyota',
          model: 'Camry',
        },
        condition: 'new',
        pricing: {
          // Missing required price
          msrp: 32000,
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with invalid year range', () => {
      const invalidPayload = {
        id: 'test-vehicle-8',
        baseIdentity: {
          year: 1800, // Below minimum (1900)
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with invalid currency code', () => {
      const invalidPayload = {
        id: 'test-vehicle-9',
        baseIdentity: {
          year: 2023,
          make: 'Toyota',
          model: 'Camry',
        },
        condition: 'new',
        pricing: {
          price: 28000,
          currency: 'US', // Invalid (must be 3 letters)
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with invalid odometer unit', () => {
      const invalidPayload = {
        id: 'test-vehicle-10',
        baseIdentity: {
          year: 2023,
          make: 'Toyota',
          model: 'Camry',
        },
        condition: 'used',
        coreSpecs: {
          odometer: {
            value: 15000,
            unit: 'miles', // Invalid (must be 'mi' or 'km')
          },
        },
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

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with missing dealer name', () => {
      const invalidPayload = {
        id: 'test-vehicle-11',
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
            // Missing required name
            city: 'Seattle',
          },
        },
        operational: {
          lastSyncedAt: new Date().toISOString(),
        },
      };

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject payload with invalid lastSyncedAt format', () => {
      const invalidPayload = {
        id: 'test-vehicle-12',
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
          lastSyncedAt: 'invalid-date', // Invalid ISO 8601 format
        },
      };

      const result = validateUVS(invalidPayload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined gracefully', () => {
      const result1 = validateUVS(null);
      expect(result1.valid).toBe(false);
      
      const result2 = validateUVS(undefined);
      expect(result2.valid).toBe(false);
    });

    it('should validate with optional fields missing', () => {
      const minimalPayload: UVS = {
        id: 'test-vehicle-13',
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

      const result = validateUVS(minimalPayload);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate with certified condition', () => {
      const certifiedPayload: UVS = {
        id: 'test-vehicle-14',
        baseIdentity: {
          year: 2022,
          make: 'Honda',
          model: 'Accord',
        },
        condition: 'certified',
        pricing: {
          price: 28500,
        },
        location: {
          dealer: {
            name: 'Certified Dealer',
          },
        },
        operational: {
          lastSyncedAt: new Date().toISOString(),
        },
      };

      const result = validateUVS(certifiedPayload);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});


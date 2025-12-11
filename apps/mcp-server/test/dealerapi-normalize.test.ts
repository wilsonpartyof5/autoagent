/**
 * Dealer API Normalize Tests
 * 
 * Tests for Generic Dealer API provider mapper normalization to UVS.
 */

import { describe, it, expect, vi } from 'vitest';
import { normalize } from '../src/ingestion/providers/dealerApi.js';
import { validateUVS } from '../src/validation/validateUVS.js';
import type { DealerAPIVehicle } from '../src/ingestion/providers/dealerApi.js';

describe('Dealer API Normalize', () => {
  it('should normalize a minimal Dealer API vehicle to valid UVS', () => {
    const raw: DealerAPIVehicle = {
      id: 'api-test-1',
      vehicle_id: 'api-vehicle-1',
      vin: '1HGBH41JXMN109186',
      stock_number: 'STK-001',
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      price: 28000,
      condition: 'used',
      dealer_name: 'Test Dealer',
      dealer_city: 'Seattle',
      dealer_state: 'WA',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.id).toBe('api-test-1');
    expect(uvs.baseIdentity.vin).toBe('1HGBH41JXMN109186');
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord');
    expect(uvs.condition).toBe('used');
    expect(uvs.pricing.price).toBe(28000);
    expect(uvs.location.dealer.name).toBe('Test Dealer');
  });

  it('should normalize a fully populated Dealer API vehicle', () => {
    const raw: DealerAPIVehicle = {
      id: 'api-test-2',
      vehicle_id: 'api-vehicle-2',
      vin: '1HGBH41JXMN109187',
      stock_number: 'STK-002',
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      trim: 'SE',
      body_type: 'Sedan',
      vehicle_type: 'car',
      condition: 'certified',
      certified: true,
      selling_price: 28500,
      msrp: 32000,
      mileage: 15000,
      fuel_type: 'Gasoline',
      transmission: 'Automatic',
      drivetrain: 'FWD',
      engine: '2.5L I4 203 HP',
      cylinders: 4,
      horsepower: 203,
      features: ['Bluetooth', 'Backup Camera', 'Lane Assist'],
      packages: [
        {
          name: 'Technology Package',
          code: 'TECH',
          price: 2000,
          description: 'Advanced tech features',
        },
      ],
      photos: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
      ],
      primary_photo_url: 'https://example.com/primary.jpg',
      dealer_id: 'dealer-123',
      dealer_name: 'Dealer API Dealer',
      dealer_city: 'Seattle',
      dealer_state: 'WA',
      days_on_market: 45,
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.condition).toBe('certified');
    expect(uvs.baseIdentity.vehicleType).toBe('car');
    expect(uvs.coreSpecs?.bodyType).toBe('Sedan');
    expect(uvs.coreSpecs?.fuelType).toBe('gasoline');
    expect(uvs.coreSpecs?.drivetrain).toBe('fwd');
    expect(uvs.coreSpecs?.odometer?.value).toBe(15000);
    expect(uvs.coreSpecs?.odometer?.unit).toBe('mi');
    expect(uvs.coreSpecs?.engine?.displacement).toBe(2.5);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(4);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(203);
    expect(uvs.coreSpecs?.transmission?.type).toBe('automatic');
    expect(uvs.featuresPackages?.features).toHaveLength(3);
    expect(uvs.featuresPackages?.features?.[0]?.name).toBe('Bluetooth');
    expect(uvs.featuresPackages?.features?.[0]?.category).toBe('technology');
    expect(uvs.media?.primaryPhotoUrl).toBe('https://example.com/primary.jpg');
    expect(uvs.media?.photoUrls).toHaveLength(2);
    expect(uvs.marketData?.averageDaysOnMarket).toBe(45);
  });

  it('should handle various field name conventions', () => {
    const raw: DealerAPIVehicle = {
      vehicleId: 'api-vehicle-3',
      vin: '1HGBH41JXMN109188',
      stockNumber: 'STK-003',
      year: 2023,
      make: 'Ford',
      model: 'F-150',
      trim: 'XLT',
      bodyType: 'Truck',
      condition: 'new',
      sellingPrice: 45000,
      msrp: 50000,
      miles: 0,
      fuelType: 'Gasoline',
      transmission: 'Automatic',
      driveTrain: '4WD',
      dealerId: 'dealer-456',
      dealerName: 'Ford Dealer',
      dealerCity: 'Portland',
      dealerState: 'OR',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.vin).toBe('1HGBH41JXMN109188');
    expect(uvs.baseIdentity.year).toBe(2023);
    expect(uvs.baseIdentity.make).toBe('Ford');
    expect(uvs.baseIdentity.model).toBe('F-150');
    expect(uvs.baseIdentity.trim).toBe('XLT');
    expect(uvs.baseIdentity.stockNumber).toBe('STK-003');
    expect(uvs.baseIdentity.vehicleType).toBe('truck');
    expect(uvs.condition).toBe('new');
    expect(uvs.pricing.price).toBe(45000);
    expect(uvs.coreSpecs?.drivetrain).toBe('4wd');
  });

  it('should parse year/make/model from description when fields are missing', () => {
    const raw: DealerAPIVehicle = {
      description: '2022 Honda Accord EX',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord EX');
  });

  it('should throw error when price is missing', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      dealer_name: 'Test Dealer',
      condition: 'used',
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should throw error when price is negative', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      price: -1000,
      dealer_name: 'Test Dealer',
      condition: 'used',
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should derive price from various price field variations', () => {
    // Test "selling_price"
    const raw1: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
    };
    expect(normalize(raw1).pricing.price).toBe(28000);

    // Test "internet_price"
    const raw2: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      internet_price: 30000,
      dealer_name: 'Test Dealer',
      condition: 'used',
    };
    expect(normalize(raw2).pricing.price).toBe(30000);

    // Test "retail_price" fallback
    const raw3: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      retail_price: 31000,
      dealer_name: 'Test Dealer',
      condition: 'used',
    };
    expect(normalize(raw3).pricing.price).toBe(31000);
  });

  it('should use fallbacks for missing year/make/model with warnings', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const raw: DealerAPIVehicle = {
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.year).toBeGreaterThanOrEqual(2020); // Current year
    expect(uvs.baseIdentity.make).toBe('Unknown');
    expect(uvs.baseIdentity.model).toBe('Vehicle');
    
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('should handle engine specs from numeric fields without description', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      cylinders: 4,
      horsepower: 203,
      displacement: 2.5,
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(4);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(203);
    expect(uvs.coreSpecs?.engine?.displacement).toBe(2.5);
  });

  it('should parse engine specs from description string', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      engine: '2.5L V6 280 HP',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.coreSpecs?.engine?.description).toBe('2.5L V6 280 HP');
    expect(uvs.coreSpecs?.engine?.displacement).toBe(2.5);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(6);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(280);
  });

  it('should categorize features correctly', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      features: ['Backup Camera', 'Bluetooth Navigation', 'Leather Seats', 'Sunroof'],
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.featuresPackages?.features).toHaveLength(4);
    
    const safetyFeature = uvs.featuresPackages?.features?.find(f => f.name === 'Backup Camera');
    expect(safetyFeature?.category).toBe('safety');
    
    const techFeature = uvs.featuresPackages?.features?.find(f => f.name === 'Bluetooth Navigation');
    expect(techFeature?.category).toBe('technology');
    
    const interiorFeature = uvs.featuresPackages?.features?.find(f => f.name === 'Leather Seats');
    expect(interiorFeature?.category).toBe('interior');
    
    const exteriorFeature = uvs.featuresPackages?.features?.find(f => f.name === 'Sunroof');
    expect(exteriorFeature?.category).toBe('exterior');
  });

  it('should preserve 0 days on market using nullish coalescing', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'new',
      days_on_market: 0,
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.marketData?.averageDaysOnMarket).toBe(0);
  });

  it('should handle various availability status values', () => {
    const rawSold: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      status: 'sold',
    };
    expect(normalize(rawSold).availability?.status).toBe('sold');

    const rawPending: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      availability: 'pending',
    };
    expect(normalize(rawPending).availability?.status).toBe('pending');

    const rawTransit: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      status: 'in-transit',
    };
    expect(normalize(rawTransit).availability?.status).toBe('in_transit');
  });

  it('should handle packages with prices', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      packages: [
        {
          name: 'Technology Package',
          code: 'TECH',
          price: 2000,
          description: 'Advanced tech features',
        },
      ],
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.featuresPackages?.packages).toHaveLength(1);
    expect(uvs.featuresPackages?.packages?.[0]?.name).toBe('Technology Package');
    expect(uvs.featuresPackages?.packages?.[0]?.price).toBe(2000);
  });

  it('should handle photo URLs from various field names', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      photos: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
      ],
      primary_photo_url: 'https://example.com/primary.jpg',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.media?.primaryPhotoUrl).toBe('https://example.com/primary.jpg');
    expect(uvs.media?.photoUrls).toHaveLength(2);
    expect(uvs.media?.photoUrls?.[0]).toBe('https://example.com/photo1.jpg');
  });

  it('should preserve raw dealer API data in dealerDefined and enrichment', () => {
    const raw: DealerAPIVehicle = {
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      selling_price: 28000,
      dealer_name: 'Test Dealer',
      condition: 'used',
      description: 'Great condition',
      notes: 'Dealer notes',
      comments: 'Customer feedback',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.dealerDefined?.raw).toBeDefined();
    expect(uvs.enrichment?.description).toBe('Great condition');
    expect(uvs.enrichment?.notes).toBe('Dealer notes');
    expect(uvs.enrichment?.comments).toBe('Customer feedback');
  });
});


/**
 * vAuto Normalize Tests
 * 
 * Tests for vAuto provider mapper normalization to UVS.
 */

import { describe, it, expect } from 'vitest';
import { normalize } from '../src/ingestion/providers/vauto.js';
import { validateUVS } from '../src/validation/validateUVS.js';
import type { VAutoVehicle } from '../src/ingestion/providers/vauto.js';

describe('vAuto Normalize', () => {
  it('should normalize a minimal vAuto vehicle to valid UVS', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-1',
      vehicleId: 'va-vehicle-1',
      vin: '1HGBH41JXMN109186',
      stockNumber: 'STK-001',
      year: 2022,
      make: 'Honda',
      model: 'Accord',
      internetPrice: 28000,
      condition: 'used',
      dealerName: 'Test Dealer',
      dealerCity: 'Seattle',
      dealerState: 'WA',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.id).toBe('va-test-1');
    expect(uvs.baseIdentity.vin).toBe('1HGBH41JXMN109186');
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord');
    expect(uvs.condition).toBe('used');
    expect(uvs.pricing.price).toBe(28000);
    expect(uvs.location.dealer.name).toBe('Test Dealer');
  });

  it('should normalize a fully populated vAuto vehicle', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-2',
      vehicleId: 'va-vehicle-2',
      vin: '1HGBH41JXMN109187',
      stockNumber: 'STK-002',
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      trim: 'SE',
      bodyType: 'Sedan',
      vehicleType: 'car',
      condition: 'certified',
      certified: true,
      internetPrice: 28500,
      retailPrice: 30000,
      msrp: 32000,
      mileage: 15000,
      fuelType: 'Gasoline',
      transmission: 'Automatic',
      drivetrain: 'FWD',
      engine: '2.5L I4 203 HP',
      cylinders: 4,
      horsepower: 203,
      displacement: 2.5,
      features: ['Bluetooth', 'Backup Camera', 'Lane Assist'],
      equipment: ['Navigation System'],
      packages: [
        {
          name: 'Technology Package',
          code: 'TECH',
          price: 2000,
          description: 'Advanced tech features',
        },
      ],
      images: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
      ],
      primaryPhotoUrl: 'https://example.com/primary.jpg',
      dealerId: 'dealer-123',
      dealerName: 'vAuto Dealer',
      dealerCity: 'Seattle',
      dealerState: 'WA',
      daysOnMarket: 45,
      turnRate: 12.5,
      pricingZone: 'Zone A',
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
    expect(uvs.featuresPackages?.features?.length).toBe(4); // features + equipment
    expect(uvs.featuresPackages?.packages?.length).toBe(1);
    expect(uvs.featuresPackages?.packages?.[0]?.price).toBe(2000);
    expect(uvs.media?.primaryPhotoUrl).toBe('https://example.com/primary.jpg');
    expect(uvs.media?.photoUrls?.length).toBe(2);
    expect(uvs.marketData?.averageDaysOnMarket).toBe(45);
    expect(uvs.availability?.status).toBe('available');
    expect(uvs.dealerDefined?.turnRate).toBe(12.5);
    expect(uvs.dealerDefined?.pricingZone).toBe('Zone A');
  });

  it('should prefer internet price over retail price', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-price',
      year: 2023,
      make: 'Test',
      model: 'Test',
      internetPrice: 25000,
      retailPrice: 28000,
      dealerName: 'Test Dealer',
    };

    const uvs = normalize(raw);
    // Should use internet price (preferred)
    expect(uvs.pricing.price).toBe(25000);
  });

  it('should use retail price when internet price not available', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-retail',
      year: 2023,
      make: 'Test',
      model: 'Test',
      retailPrice: 28000,
      dealerName: 'Test Dealer',
    };

    const uvs = normalize(raw);
    // Should use retail price as fallback
    expect(uvs.pricing.price).toBe(28000);
  });

  it('should handle various field name variations', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-3',
      vehicle_id: 'va-vehicle-3',
      stock_no: 'STK-003', // snake_case
      year: 2021,
      make: 'Ford',
      model: 'F-150',
      body_type: 'Truck', // snake_case
      internet_price: 35000, // snake_case
      list_price: 40000, // snake_case instead of msrp
      miles: 20000,
      fuel_type: 'Gasoline', // snake_case
      drive_train: '4WD', // snake_case
      dealer_name: 'Ford Dealer', // snake_case
      dealer_city: 'Bellevue',
      dealer_state: 'WA',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.stockNumber).toBe('STK-003');
    expect(uvs.baseIdentity.make).toBe('Ford');
    expect(uvs.baseIdentity.vehicleType).toBe('truck');
    expect(uvs.pricing.price).toBe(35000);
    expect(uvs.pricing.msrp).toBe(40000);
    expect(uvs.coreSpecs?.odometer?.value).toBe(20000);
    expect(uvs.location.dealer.name).toBe('Ford Dealer');
  });

  it('should derive vehicleType from body_type', () => {
    const testCases = [
      { bodyType: 'Sedan', expected: 'car' },
      { bodyType: 'SUV', expected: 'suv' },
      { bodyType: 'Truck', expected: 'truck' },
      { bodyType: 'Van', expected: 'van' },
      { bodyType: 'Coupe', expected: 'car' },
    ];

    testCases.forEach(({ bodyType, expected }) => {
      const raw: VAutoVehicle = {
        id: `va-test-${bodyType}`,
        year: 2020,
        make: 'Test',
        model: 'Test',
        bodyType,
        internetPrice: 10000,
        dealerName: 'Test Dealer',
      };

      const uvs = normalize(raw);
      expect(uvs.baseIdentity.vehicleType).toBe(expected);
    });
  });

  it('should parse engine specs from description string', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-engine',
      year: 2020,
      make: 'Test',
      model: 'Test',
      internetPrice: 10000,
      dealerName: 'Test Dealer',
      engine: '3.5L V6 300 HP',
    };

    const uvs = normalize(raw);
    expect(uvs.coreSpecs?.engine?.displacement).toBe(3.5);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(6);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(300);
  });

  it('should enhance engine specs with explicit fields', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-engine-explicit',
      year: 2020,
      make: 'Test',
      model: 'Test',
      internetPrice: 10000,
      dealerName: 'Test Dealer',
      engine: 'V6',
      cylinders: 6,
      horsepower: 280,
      displacement: 3.6,
    };

    const uvs = normalize(raw);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(6);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(280);
    expect(uvs.coreSpecs?.engine?.displacement).toBe(3.6);
  });

  it('should categorize features correctly', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-features',
      year: 2020,
      make: 'Test',
      model: 'Test',
      internetPrice: 10000,
      dealerName: 'Test Dealer',
      features: [
        'Bluetooth',
        'Backup Camera',
        'Lane Assist',
        'Heated Seats',
        'Sunroof',
        'Sport Suspension',
        'Premium Audio',
      ],
    };

    const uvs = normalize(raw);
    expect(uvs.featuresPackages?.features).toBeDefined();
    
    const featureMap = new Map(uvs.featuresPackages?.features?.map(f => [f.name, f.category]));
    expect(featureMap.get('Bluetooth')).toBe('technology');
    expect(featureMap.get('Backup Camera')).toBe('safety');
    expect(featureMap.get('Lane Assist')).toBe('safety');
    expect(featureMap.get('Heated Seats')).toBe('convenience');
    expect(featureMap.get('Sunroof')).toBe('exterior');
    expect(featureMap.get('Sport Suspension')).toBe('performance');
    expect(featureMap.get('Premium Audio')).toBe('entertainment');
  });

  it('should reject listings without dealer-provided price', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-no-price',
      year: 2020,
      make: 'Test',
      model: 'Test',
      dealerName: 'Test Dealer',
      // No price fields
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should derive price from price_history when current prices missing', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-price-history',
      year: 2020,
      make: 'Test',
      model: 'Test',
      dealerName: 'Test Dealer',
      // No current price
      priceHistory: [
        {
          price: 25000,
          timestamp: Date.now() / 1000 - 86400, // 1 day ago
        },
        {
          price: 26000,
          timestamp: Date.now() / 1000 - 172800, // 2 days ago
        },
      ],
    };

    const uvs = normalize(raw);
    // Should use most recent price from history
    expect(uvs.pricing.price).toBe(25000);
  });

  it('should preserve 0 days on market in marketData', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-dom-zero',
      year: 2024,
      make: 'Test',
      model: 'Test',
      internetPrice: 35000,
      condition: 'new',
      dealerName: 'Test Dealer',
      daysOnMarket: 0, // Zero is a valid value
    };

    const uvs = normalize(raw);
    expect(uvs.marketData).toBeDefined();
    expect(uvs.marketData?.averageDaysOnMarket).toBe(0);
  });

  it('should handle missing data gracefully with fallbacks', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-fallback',
      internetPrice: 10000,
      condition: 'used',
      dealerName: 'Test Dealer',
      // Missing year/make/model
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.year).toBeGreaterThanOrEqual(2024); // Current year fallback
    expect(uvs.baseIdentity.make).toBe('Unknown');
    expect(uvs.baseIdentity.model).toBe('Vehicle');
  });

  it('should handle new condition correctly', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-new',
      year: 2024,
      make: 'Test',
      model: 'Test',
      internetPrice: 35000,
      condition: 'new',
      dealerName: 'Test Dealer',
    };

    const uvs = normalize(raw);
    expect(uvs.condition).toBe('new');
  });

  it('should handle certified condition correctly', () => {
    const raw: VAutoVehicle = {
      id: 'va-test-cpo',
      year: 2022,
      make: 'Test',
      model: 'Test',
      internetPrice: 30000,
      condition: 'certified',
      certified: true,
      dealerName: 'Test Dealer',
    };

    const uvs = normalize(raw);
    expect(uvs.condition).toBe('certified');
  });
});


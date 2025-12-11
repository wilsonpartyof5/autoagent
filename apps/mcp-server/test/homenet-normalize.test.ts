/**
 * Homenet Normalize Tests
 * 
 * Tests for Homenet provider mapper normalization to UVS.
 */

import { describe, it, expect } from 'vitest';
import { normalize } from '../src/ingestion/providers/homenet.js';
import { validateUVS } from '../src/validation/validateUVS.js';
import type { HomenetVehicle } from '../src/ingestion/providers/homenet.js';

describe('Homenet Normalize', () => {
  it('should normalize a minimal Homenet vehicle to valid UVS', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-1',
      vehicle_id: 'hn-vehicle-1',
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
    expect(uvs.id).toBe('hn-test-1');
    expect(uvs.baseIdentity.vin).toBe('1HGBH41JXMN109186');
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord');
    expect(uvs.condition).toBe('used');
    expect(uvs.pricing.price).toBe(28000);
    expect(uvs.location.dealer.name).toBe('Test Dealer');
  });

  it('should normalize a fully populated Homenet vehicle', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-2',
      vehicle_id: 'hn-vehicle-2',
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
      price: 28500,
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
      dealer_name: 'Homenet Dealer',
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
    expect(uvs.featuresPackages?.features?.length).toBe(3);
    expect(uvs.featuresPackages?.packages?.length).toBe(1);
    expect(uvs.featuresPackages?.packages?.[0]?.price).toBe(2000);
    expect(uvs.media?.primaryPhotoUrl).toBe('https://example.com/primary.jpg');
    expect(uvs.media?.photoUrls?.length).toBe(2);
    expect(uvs.marketData?.averageDaysOnMarket).toBe(45);
    expect(uvs.availability?.status).toBe('available');
  });

  it('should handle various field name variations', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-3',
      vehicle_id: 'hn-vehicle-3',
      stockNumber: 'STK-003', // camelCase
      year: 2021,
      manufacturer: 'Ford', // manufacturer instead of make
      model: 'F-150',
      bodyType: 'Truck', // camelCase
      sellingPrice: 35000, // sellingPrice instead of price
      listPrice: 40000, // listPrice instead of msrp
      miles: 20000,
      fuelType: 'Gasoline', // camelCase
      driveTrain: '4WD', // camelCase
      dealerName: 'Ford Dealer', // camelCase
      dealerCity: 'Bellevue',
      dealerState: 'WA',
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
      { body_type: 'Sedan', expected: 'car' },
      { body_type: 'SUV', expected: 'suv' },
      { body_type: 'Truck', expected: 'truck' },
      { body_type: 'Van', expected: 'van' },
      { body_type: 'Coupe', expected: 'car' },
      { body_type: 'Wagon', expected: 'car' },
    ];

    testCases.forEach(({ body_type, expected }) => {
      const raw: HomenetVehicle = {
        id: `hn-test-${body_type}`,
        year: 2020,
        make: 'Test',
        model: 'Test',
        body_type,
        price: 10000,
        dealer_name: 'Test Dealer',
      };

      const uvs = normalize(raw);
      expect(uvs.baseIdentity.vehicleType).toBe(expected);
    });
  });

  it('should parse engine specs from description string', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-engine',
      year: 2020,
      make: 'Test',
      model: 'Test',
      price: 10000,
      dealer_name: 'Test Dealer',
      engine: '3.5L V6 300 HP',
    };

    const uvs = normalize(raw);
    expect(uvs.coreSpecs?.engine?.displacement).toBe(3.5);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(6);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(300);
  });

  it('should categorize features correctly', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-features',
      year: 2020,
      make: 'Test',
      model: 'Test',
      price: 10000,
      dealer_name: 'Test Dealer',
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
    const raw: HomenetVehicle = {
      id: 'hn-test-no-price',
      year: 2020,
      make: 'Test',
      model: 'Test',
      dealer_name: 'Test Dealer',
      // No price, no price_history
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should derive price from price_history when current price is missing', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-price-history',
      year: 2020,
      make: 'Test',
      model: 'Test',
      dealer_name: 'Test Dealer',
      // No current price
      price_history: [
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

  it('should handle missing data gracefully with fallbacks', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-fallback',
      price: 10000,
      condition: 'used',
      dealer_name: 'Test Dealer',
      // Missing year/make/model
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.year).toBeGreaterThanOrEqual(2024); // Current year fallback
    expect(uvs.baseIdentity.make).toBe('Unknown');
    expect(uvs.baseIdentity.model).toBe('Vehicle');
  });

  it('should parse year/make/model from description when fields missing', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-description',
      price: 25000,
      condition: 'used',
      dealer_name: 'Test Dealer',
      description: '2021 Toyota Camry SE',
      // Missing year/make/model fields
    };

    const uvs = normalize(raw);
    expect(uvs.baseIdentity.year).toBe(2021);
    expect(uvs.baseIdentity.make).toBe('Toyota');
    expect(uvs.baseIdentity.model).toBe('Camry SE');
  });

  it('should handle new condition correctly', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-new',
      year: 2024,
      make: 'Test',
      model: 'Test',
      price: 35000,
      condition: 'new',
      dealer_name: 'Test Dealer',
    };

    const uvs = normalize(raw);
    expect(uvs.condition).toBe('new');
  });

  it('should handle certified condition correctly', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-cpo',
      year: 2022,
      make: 'Test',
      model: 'Test',
      price: 30000,
      condition: 'certified',
      certified: true,
      dealer_name: 'Test Dealer',
    };

    const uvs = normalize(raw);
    expect(uvs.condition).toBe('certified');
  });

  it('should preserve 0 days on market in marketData', () => {
    const raw: HomenetVehicle = {
      id: 'hn-test-dom-zero',
      year: 2024,
      make: 'Test',
      model: 'Test',
      price: 35000,
      condition: 'new',
      dealer_name: 'Test Dealer',
      days_on_market: 0, // Zero is a valid value
    };

    const uvs = normalize(raw);
    expect(uvs.marketData).toBeDefined();
    expect(uvs.marketData?.averageDaysOnMarket).toBe(0);
  });

  it('should handle various days_on_market field name variations', () => {
    const testCases = [
      { days_on_market: 10 },
      { daysOnMarket: 15 },
      { dom: 20 },
    ];

    testCases.forEach((fields, index) => {
      const raw: HomenetVehicle = {
        id: `hn-test-dom-${index}`,
        year: 2023,
        make: 'Test',
        model: 'Test',
        price: 30000,
        dealer_name: 'Test Dealer',
        ...fields,
      };

      const uvs = normalize(raw);
      expect(uvs.marketData).toBeDefined();
      expect(uvs.marketData?.averageDaysOnMarket).toBe(Object.values(fields)[0]);
    });
  });
});


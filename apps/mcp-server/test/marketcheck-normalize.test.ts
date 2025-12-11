/**
 * MarketCheck Normalize Tests
 * 
 * Tests for MarketCheck provider mapper normalization to UVS.
 */

import { describe, it, expect } from 'vitest';
import { normalize } from '../src/ingestion/providers/marketcheck.js';
import { validateUVS } from '../src/validation/validateUVS.js';
import type { MarketCheckVehicle } from '@autoagent/shared';

describe('MarketCheck Normalize', () => {
  it('should normalize a minimal MarketCheck vehicle to valid UVS', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-1',
      vin: '1HGBH41JXMN109186',
      stock_no: 'STK-001',
      price: 28000,
      inventory_type: 'used',
      dealer: {
        id: '12345',
        name: 'Test Dealer',
        city: 'Seattle',
        state: 'WA',
      },
      build: {
        year: 2022,
        make: 'Honda',
        model: 'Accord',
      },
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.id).toBe('mc-test-1');
    expect(uvs.baseIdentity.vin).toBe('1HGBH41JXMN109186');
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord');
    expect(uvs.condition).toBe('used');
    expect(uvs.pricing.price).toBe(28000);
    expect(uvs.location.dealer.name).toBe('Test Dealer');
  });

  it('should normalize a fully populated MarketCheck vehicle with enrichment', () => {
    const raw: MarketCheckVehicle & { extra?: { options?: Array<{ name?: string; code?: string; description?: string; price?: number }>; specifications?: Record<string, unknown> } } = {
      id: 'mc-test-2',
      vin: '1HGBH41JXMN109187',
      stock_no: 'STK-002',
      heading: '2022 Honda Accord EX-L',
      price: 28500,
      msrp: 32000,
      dom: 45,
      inventory_type: 'cpo',
      certified: true,
      exterior_color: 'Midnight Black',
      interior_color: 'Charcoal',
      mileage: 15000,
      miles: 15000,
      source: 'marketcheck',
      dealer: {
        id: '12346',
        name: 'Honda of Seattle',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      },
      build: {
        year: 2022,
        make: 'Honda',
        model: 'Accord',
        trim: 'EX-L',
        body_type: 'Sedan',
        drivetrain: 'FWD',
        fuel_type: 'Gasoline',
        transmission: '10-Speed Automatic',
      },
      features: [
        'Bluetooth',
        'Backup Camera',
        'Lane Assist',
        'Navigation System',
      ],
      media: {
        photo_links: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ],
        primary_photo_url: 'https://example.com/primary.jpg',
      },
      extra: {
        options: [
          {
            name: 'Technology Package',
            code: 'TECH',
            price: 2000,
            description: 'Advanced tech features',
          },
        ],
        specifications: {
          displacement: 2.0,
          cylinders: 4,
          horsepower: 252,
        },
      },
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
    expect(uvs.coreSpecs?.engine?.displacement).toBe(2.0);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(4);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(252);
    expect(uvs.featuresPackages?.features?.length).toBeGreaterThan(0);
    expect(uvs.featuresPackages?.packages?.length).toBe(1);
    expect(uvs.featuresPackages?.packages?.[0]?.price).toBe(2000);
    expect(uvs.media?.primaryPhotoUrl).toBe('https://example.com/primary.jpg');
    expect(uvs.media?.photoUrls?.length).toBe(2);
    expect(uvs.marketData?.averageDaysOnMarket).toBe(45);
    expect(uvs.availability?.status).toBe('available');
  });

  it('should derive vehicleType from body_type', () => {
    const testCases = [
      { body_type: 'Sedan', expected: 'car' },
      { body_type: 'SUV', expected: 'suv' },
      { body_type: 'Truck', expected: 'truck' },
      { body_type: 'Van', expected: 'van' },
      { body_type: 'Coupe', expected: 'car' },
      { body_type: 'Wagon', expected: 'car' },
      { body_type: 'Unknown', expected: 'other' },
    ];

    testCases.forEach(({ body_type, expected }) => {
      const raw: MarketCheckVehicle = {
        id: 'mc-test',
        price: 10000,
        inventory_type: 'used',
        dealer: { name: 'Test Dealer' },
        build: {
          year: 2020,
          make: 'Test',
          model: 'Test',
          body_type,
        },
      };

      const uvs = normalize(raw);
      expect(uvs.baseIdentity.vehicleType).toBe(expected);
    });
  });

  it('should parse engine specs from description string', () => {
    const raw: MarketCheckVehicle & { build?: { engine?: string } } = {
      id: 'mc-test',
      price: 10000,
      inventory_type: 'used',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
        engine: '3.5L V6 300 HP',
      },
    };

    const uvs = normalize(raw);
    expect(uvs.coreSpecs?.engine?.displacement).toBe(3.5);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(6);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(300);
  });

  it('should categorize features correctly', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test',
      price: 10000,
      inventory_type: 'used',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
      },
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

  it('should handle missing data gracefully', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-minimal',
      price: 10000,
      inventory_type: 'used',
      dealer: {
        name: 'Test Dealer',
      },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
      },
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.id).toBe('mc-test-minimal');
    expect(uvs.baseIdentity.year).toBe(2020);
    expect(uvs.pricing.price).toBe(10000);
    expect(uvs.location.dealer.name).toBe('Test Dealer');
  });

  it('should handle new condition correctly', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-new',
      price: 35000,
      inventory_type: 'new',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2024,
        make: 'Test',
        model: 'Test',
      },
    };

    const uvs = normalize(raw);
    expect(uvs.condition).toBe('new');
  });

  it('should handle certified condition correctly', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-cpo',
      price: 30000,
      inventory_type: 'cpo',
      certified: true,
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2022,
        make: 'Test',
        model: 'Test',
      },
    };

    const uvs = normalize(raw);
    expect(uvs.condition).toBe('certified');
  });

  it('should parse year/make/model from heading when build data is missing', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-heading',
      price: 25000,
      inventory_type: 'used',
      heading: '2021 Toyota Camry SE',
      dealer: { name: 'Test Dealer' },
      // No build data
    };

    const uvs = normalize(raw);
    expect(uvs.baseIdentity.year).toBe(2021);
    expect(uvs.baseIdentity.make).toBe('Toyota');
    // Model includes trim for now (can be enhanced later to extract trim separately)
    expect(uvs.baseIdentity.model).toBe('Camry SE');
  });

  it('should use fallbacks when heading parsing fails', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-fallback',
      price: 20000,
      inventory_type: 'used',
      heading: 'Invalid Heading Format',
      dealer: { name: 'Test Dealer' },
      // No build data
    };

    const uvs = normalize(raw);
    // Should fallback to current year and Unknown/Vehicle
    expect(uvs.baseIdentity.year).toBeGreaterThanOrEqual(2024);
    expect(uvs.baseIdentity.make).toBe('Unknown');
    expect(uvs.baseIdentity.model).toBe('Vehicle');
  });

  it('should reject listings without dealer-provided price', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-no-price',
      // No price, no price_history
      inventory_type: 'used',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
      },
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should reject listings with negative prices', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-negative-price',
      price: -1000,
      inventory_type: 'used',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
      },
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should derive price from price_history when current price is missing', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-price-history',
      // No current price
      inventory_type: 'used',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
      },
      price_history: [
        {
          price: 25000,
          timestamp: Date.now() / 1000 - 86400, // 1 day ago
          source: 'marketcheck',
        },
        {
          price: 26000,
          timestamp: Date.now() / 1000 - 172800, // 2 days ago
          source: 'marketcheck',
        },
      ],
    };

    const uvs = normalize(raw);
    // Should use most recent price from history
    expect(uvs.pricing.price).toBe(25000);
  });

  it('should use current price when both current price and price_history exist', () => {
    const raw: MarketCheckVehicle = {
      id: 'mc-test-both-prices',
      price: 28000,
      inventory_type: 'used',
      dealer: { name: 'Test Dealer' },
      build: {
        year: 2020,
        make: 'Test',
        model: 'Test',
      },
      price_history: [
        {
          price: 25000,
          timestamp: Date.now() / 1000 - 86400,
          source: 'marketcheck',
        },
      ],
    };

    const uvs = normalize(raw);
    // Should prefer current price over history
    expect(uvs.pricing.price).toBe(28000);
  });
});


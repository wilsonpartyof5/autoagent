/**
 * CSV Import Normalize Tests
 * 
 * Tests for CSV Import provider mapper normalization to UVS.
 */

import { describe, it, expect } from 'vitest';
import { normalize } from '../src/ingestion/providers/csvImport.js';
import { validateUVS } from '../src/validation/validateUVS.js';
import type { CSVVehicleRow } from '../src/ingestion/providers/csvImport.js';

describe('CSV Import Normalize', () => {
  it('should normalize a minimal CSV vehicle to valid UVS', () => {
    const raw: CSVVehicleRow = {
      id: 'csv-test-1',
      VIN: '1HGBH41JXMN109186',
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      Condition: 'used',
      'Dealer Name': 'Test Dealer',
      'Dealer City': 'Seattle',
      'Dealer State': 'WA',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.id).toBe('csv-test-1');
    expect(uvs.baseIdentity.vin).toBe('1HGBH41JXMN109186');
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord');
    expect(uvs.condition).toBe('used');
    expect(uvs.pricing.price).toBe(28000);
    expect(uvs.location.dealer.name).toBe('Test Dealer');
  });

  it('should normalize a fully populated CSV vehicle', () => {
    const raw: CSVVehicleRow = {
      id: 'csv-test-2',
      VIN: '1HGBH41JXMN109187',
      Year: 2022,
      Make: 'Toyota',
      Model: 'Camry',
      Trim: 'SE',
      Stock: 'STK-002',
      'Body Type': 'Sedan',
      'Vehicle Type': 'car',
      Condition: 'certified',
      Price: 28500,
      MSRP: 32000,
      Mileage: 15000,
      'Fuel Type': 'Gasoline',
      Transmission: 'Automatic',
      Drivetrain: 'FWD',
      Engine: '2.5L I4 203 HP',
      Cylinders: 4,
      Horsepower: 203,
      Features: 'Bluetooth,Backup Camera,Lane Assist',
      Photos: 'https://example.com/photo1.jpg,https://example.com/photo2.jpg',
      'Primary Photo': 'https://example.com/primary.jpg',
      'Dealer ID': 'dealer-123',
      'Dealer Name': 'CSV Dealer',
      'Dealer City': 'Seattle',
      'Dealer State': 'WA',
      'Days On Market': 45,
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

  it('should handle various CSV column name variations', () => {
    const raw: CSVVehicleRow = {
      vin: '1HGBH41JXMN109188',
      year: 2023,
      make: 'Ford',
      model: 'F-150',
      trim: 'XLT',
      stock: 'STK-003',
      bodyType: 'Truck',
      condition: 'new',
      price: 45000,
      msrp: 50000,
      mileage: 0,
      fuelType: 'Gasoline',
      transmission: 'Automatic',
      drivetrain: '4WD',
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
    const raw: CSVVehicleRow = {
      Description: '2022 Honda Accord EX',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.baseIdentity.year).toBe(2022);
    expect(uvs.baseIdentity.make).toBe('Honda');
    expect(uvs.baseIdentity.model).toBe('Accord EX');
  });

  it('should throw error when price is missing', () => {
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should throw error when price is negative', () => {
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: -1000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
    };

    expect(() => normalize(raw)).toThrow('Missing dealer-provided price');
  });

  it('should derive price from various price field variations', () => {
    // Test "Selling Price"
    const raw1: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      'Selling Price': 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
    };
    expect(normalize(raw1).pricing.price).toBe(28000);

    // Test "List Price"
    const raw2: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      'List Price': 30000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
    };
    expect(normalize(raw2).pricing.price).toBe(30000);
  });

  it('should use fallbacks for missing year/make/model with warnings', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const raw: CSVVehicleRow = {
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
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
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Cylinders: 4,
      Horsepower: 203,
      Displacement: 2.5,
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.coreSpecs?.engine?.cylinders).toBe(4);
    expect(uvs.coreSpecs?.engine?.horsepower).toBe(203);
    expect(uvs.coreSpecs?.engine?.displacement).toBe(2.5);
  });

  it('should parse engine specs from description string', () => {
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Engine: '2.5L V6 280 HP',
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
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Features: 'Backup Camera,Bluetooth Navigation,Leather Seats,Sunroof',
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
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'new',
      'Days On Market': 0,
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.marketData?.averageDaysOnMarket).toBe(0);
  });

  it('should handle various availability status values', () => {
    const rawSold: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Status: 'sold',
    };
    expect(normalize(rawSold).availability?.status).toBe('sold');

    const rawPending: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Availability: 'pending',
    };
    expect(normalize(rawPending).availability?.status).toBe('pending');

    const rawTransit: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Status: 'in-transit',
    };
    expect(normalize(rawTransit).availability?.status).toBe('in_transit');
  });

  it('should handle packages with prices', () => {
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Packages: [
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
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Photos: 'https://example.com/photo1.jpg,https://example.com/photo2.jpg',
      'Primary Photo': 'https://example.com/primary.jpg',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.media?.primaryPhotoUrl).toBe('https://example.com/primary.jpg');
    expect(uvs.media?.photoUrls).toHaveLength(2);
    expect(uvs.media?.photoUrls?.[0]).toBe('https://example.com/photo1.jpg');
  });

  it('should preserve raw CSV data in dealerDefined and enrichment', () => {
    const raw: CSVVehicleRow = {
      Year: 2022,
      Make: 'Honda',
      Model: 'Accord',
      Price: 28000,
      'Dealer Name': 'Test Dealer',
      Condition: 'used',
      Description: 'Great condition',
      Notes: 'Dealer notes',
    };

    const uvs = normalize(raw);
    const validation = validateUVS(uvs);

    expect(validation.valid).toBe(true);
    expect(uvs.dealerDefined?.raw).toBeDefined();
    expect(uvs.enrichment?.description).toBe('Great condition');
    expect(uvs.enrichment?.notes).toBe('Dealer notes');
  });
});


import { describe, expect, it } from 'vitest';
import {
  assignStableVehicleIds,
  existingVinIdMap,
  normalizeVin,
  retiredVehicleIds,
  rooftopVehicleOrFilter,
} from '../src/ingestion/vehicleIdentity.js';

describe('normalizeVin', () => {
  it('uppercases and trims', () => {
    expect(normalizeVin(' 1ftabc ')).toBe('1FTABC');
  });

  it('returns null for empty values', () => {
    expect(normalizeVin(null)).toBeNull();
    expect(normalizeVin('   ')).toBeNull();
  });
});

describe('assignStableVehicleIds', () => {
  it('reuses the rooftop row when the VIN already lives there', () => {
    const remapped = assignStableVehicleIds(
      [{ id: 'listing-new', vin: '1ftabc' }],
      new Map([['1FTABC', 'stable-row']]),
    );
    expect(remapped).toEqual([{ id: 'stable-row', vin: '1FTABC' }]);
  });

  it('keeps the listing id when the VIN is new to the rooftop', () => {
    const remapped = assignStableVehicleIds(
      [{ id: 'listing-new', vin: '1FTABC' }],
      new Map(),
    );
    expect(remapped[0].id).toBe('listing-new');
  });
});

describe('existingVinIdMap', () => {
  it('prefers the row that already has a rooftop id', () => {
    const map = existingVinIdMap([
      { id: 'legacy', vin: '1FTABC', dealership_id: null },
      { id: 'owned', vin: '1ftabc', dealership_id: 'rooftop-1' },
    ]);
    expect(map.get('1FTABC')).toBe('owned');
  });
});

describe('retiredVehicleIds', () => {
  it('keeps cars whose VIN is still in the feed even if the listing id changed', () => {
    const retired = retiredVehicleIds(
      [
        { id: 'stable-row', vin: '1FTABC' },
        { id: 'gone', vin: '2GONE00' },
      ],
      [{ id: 'listing-new', vin: '1FTABC' }],
    );
    expect(retired).toEqual(['gone']);
  });

  it('matches VIN-less rows by listing id', () => {
    const retired = retiredVehicleIds(
      [
        { id: 'keep-me', vin: null },
        { id: 'drop-me', vin: null },
      ],
      [{ id: 'keep-me', vin: null }],
    );
    expect(retired).toEqual(['drop-me']);
  });
});

describe('rooftopVehicleOrFilter', () => {
  it('includes unassigned MarketCheck leftovers when a dealer id is present', () => {
    expect(rooftopVehicleOrFilter('rooftop-1', '1038994')).toBe(
      'dealership_id.eq.rooftop-1,and(dealership_id.is.null,dealer_id.eq.1038994)',
    );
  });
});

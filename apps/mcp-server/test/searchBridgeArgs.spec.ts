import { describe, expect, it } from 'vitest';
import {
  mapSearchParamsToBridgeArgs,
  normalizeBodyType,
  resolveBridgeLocation,
} from '../src/tools/searchVehicles.js';

describe('MarketCheck bridge arg mapping', () => {
  it('normalizes pickup/truck body styles and drops invented ones', () => {
    expect(normalizeBodyType('Pickup')).toBe('Pickup');
    expect(normalizeBodyType('truck')).toBe('Pickup');
    expect(normalizeBodyType('SUV')).toBe('SUV');
    expect(normalizeBodyType('F-150')).toBeUndefined();
    expect(normalizeBodyType('electric')).toBeUndefined();
  });

  it('resolves metro-style locations to city/state', () => {
    expect(resolveBridgeLocation({ location: 'denver metro area' } as any)).toEqual({
      city: 'Denver',
      state: 'CO',
    });
    expect(resolveBridgeLocation({ location: 'Denver, CO' } as any)).toEqual({
      city: 'Denver',
      state: 'CO',
    });
    expect(resolveBridgeLocation({ location: '29730' } as any)).toEqual({
      zip: '29730',
    });
  });

  it('omits body_type when bodyStyle is not a known MarketCheck value', () => {
    const args = mapSearchParamsToBridgeArgs({
      location: 'Denver, CO',
      condition: 'new',
      make: 'Ford',
      model: 'F-150',
      radiusMiles: 75,
      bodyStyle: 'F-150',
    } as any);
    expect(args.body_type).toBeUndefined();
    expect(args.city).toBe('Denver');
    expect(args.state).toBe('CO');
    expect(args.make).toBe('Ford');
    expect(args.model).toBe('F-150');
  });

  it('requests a dense map pin set without fetching every photo', () => {
    const args = mapSearchParamsToBridgeArgs({
      location: 'Dallas, TX',
      condition: 'used',
      radiusMiles: 50,
      maxPrice: 30000,
    } as any);
    expect(args.rows).toBe(80);
    expect(args.fetch_all_photos).toBe(false);
    expect(args.city).toBe('Dallas');
    expect(args.state).toBe('TX');
    expect(args.price_range).toBe('0-30000');
  });

  it('passes the widget pagination offset to MarketCheck', () => {
    const args = mapSearchParamsToBridgeArgs({
      location: 'Charlotte, NC',
      condition: 'used',
      make: 'Ford',
      model: 'F-150',
      maxPrice: 48000,
      pageOffset: 50,
    } as any);
    expect(args.start).toBe(50);
    expect(args.price_range).toBe('0-48000');
  });
});

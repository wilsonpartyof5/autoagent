import { describe, expect, it } from 'vitest';
import {
  DEALERSHIP_INVENTORY_PATH,
  SYNDICATION_MAX_ROWS,
  buildDealershipInventoryUrl,
  normalizeSyndicationSource,
} from '../src/ingestion/marketcheckSyndication.js';

describe('normalizeSyndicationSource', () => {
  it('strips protocol and www', () => {
    expect(normalizeSyndicationSource('https://www.myrockhillgmc.com/inventory')).toBe(
      'myrockhillgmc.com',
    );
  });

  it('accepts a bare hostname', () => {
    expect(normalizeSyndicationSource('HondaCarsOfRockHill.com')).toBe(
      'hondacarsofrockhill.com',
    );
  });
});

describe('buildDealershipInventoryUrl', () => {
  const base = 'https://api.marketcheck.com';

  it('targets Dealership Inventory Syndication, not live search', () => {
    const url = buildDealershipInventoryUrl(base, {
      apiKey: 'k',
      dealerId: '11042155',
      source: 'https://www.myrockhillgmc.com',
    });
    const parsed = new URL(url);

    expect(parsed.pathname).toBe(DEALERSHIP_INVENTORY_PATH);
    expect(parsed.pathname).not.toContain('/v2/search/car/active');
    expect(parsed.pathname).not.toContain('/v2/car/dealer/inventory/active');
    expect(parsed.searchParams.get('mc_website_id')).toBe('11042155');
    expect(parsed.searchParams.get('dealer_id')).toBe('11042155');
    expect(parsed.searchParams.get('source')).toBe('myrockhillgmc.com');
    expect(parsed.searchParams.get('rows')).toBe(String(SYNDICATION_MAX_ROWS));
    expect(parsed.searchParams.get('start')).toBe('0');
    expect(parsed.searchParams.has('radius')).toBe(false);
    expect(parsed.searchParams.has('zip')).toBe(false);
  });

  it('paginates with start/rows', () => {
    const url = buildDealershipInventoryUrl(base, {
      apiKey: 'k',
      dealerId: '1',
      start: 1500,
      rows: 1500,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('start')).toBe('1500');
    expect(parsed.searchParams.get('rows')).toBe('1500');
  });

  it('caps rows at 1500', () => {
    const url = buildDealershipInventoryUrl(base, {
      apiKey: 'k',
      source: 'example.com',
      rows: 9999,
    });
    expect(new URL(url).searchParams.get('rows')).toBe('1500');
  });

  it('requires a dealer identifier', () => {
    expect(() =>
      buildDealershipInventoryUrl(base, { apiKey: 'k' }),
    ).toThrow(/dealerId or source/);
  });
});

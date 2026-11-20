import assert from 'node:assert/strict';
import test from 'node:test';

import { DiscoverApiError } from './errors';
import { parseDiscoverSearchBody, parseListingId } from './schema';

test('search body requires a real lat/lng and caps radius and page size', () => {
  const ok = parseDiscoverSearchBody({
    latitude: 35.2271,
    longitude: -80.8431,
    radius_miles: 50,
    page: 10,
    page_size: 20,
    filters: { make: 'Toyota', body_type: 'SUV', condition: 'used', price_max: 35000 },
  });
  assert.equal(ok.radius_miles, 50);
  assert.equal(ok.page_size, 20);
  assert.equal(ok.filters.make, 'Toyota');
});

test('search defaults fill in radius, page, and empty filters', () => {
  const ok = parseDiscoverSearchBody({ latitude: 34.92, longitude: -81.02 });
  assert.equal(ok.radius_miles, 25);
  assert.equal(ok.page, 1);
  assert.equal(ok.page_size, 10);
  assert.deepEqual(ok.filters, {});
});

test('zero-island and out-of-range coordinates are INVALID_LOCATION', () => {
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 0, longitude: 0 }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_LOCATION' && error.status === 400,
  );
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 91, longitude: -80 }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_LOCATION',
  );
});

test('unknown fields, oversize pages, and bad filters are typed 400s', () => {
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 35, longitude: -80, dealerId: 'secret' }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_REQUEST',
  );
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 35, longitude: -80, page: 11 }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_PAGINATION',
  );
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 35, longitude: -80, page_size: 21 }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_PAGINATION',
  );
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 35, longitude: -80, radius_miles: 51 }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_LOCATION',
  );
  assert.throws(
    () => parseDiscoverSearchBody({ latitude: 35, longitude: -80, filters: { body_type: 'Truck' } }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_FILTERS',
  );
  assert.throws(
    () => parseDiscoverSearchBody({
      latitude: 35,
      longitude: -80,
      filters: { year: 2020, year_min: 2018 },
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_FILTERS',
  );
  assert.throws(
    () => parseDiscoverSearchBody({
      latitude: 35,
      longitude: -80,
      filters: { price_min: 40000, price_max: 10000 },
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_FILTERS',
  );
});

test('listing ids must be 4-64 url-safe characters', () => {
  assert.equal(parseListingId('mc-listing-1'), 'mc-listing-1');
  assert.throws(
    () => parseListingId('../etc/passwd'),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_ID' && error.status === 400,
  );
  assert.throws(
    () => parseListingId('ab'),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_ID',
  );
});

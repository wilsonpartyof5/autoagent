import assert from 'node:assert/strict';
import test from 'node:test';

import type { DetailResponse, LiveVehicle } from '../marketcheck/mcp-adapter';

import {
  assertPublicListing,
  publicListingFromDetail,
  publicListingFromSearchVehicle,
  publicListingsContainForbiddenKey,
  rankPhotoLessListingsLast,
} from './allowlist';

const SECRET = 'test-marketcheck-key-do-not-ship';

function liveVehicle(overrides: Partial<LiveVehicle> = {}): LiveVehicle {
  return {
    id: 'listing-1',
    vin: '4T1B11HK5JU123456',
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    condition: 'used',
    price: 28990,
    msrp: 32110,
    miles: 41200,
    bodyType: 'SUV',
    primaryPhotoUrl: 'https://cdn.dealer.example/rav4.jpg',
    photoUrls: ['https://cdn.dealer.example/rav4.jpg', `https://images.marketcheck.com/x.jpg?api_key=${SECRET}`],
    location: {
      latitude: 35.21,
      longitude: -80.85,
      dealerName: 'Rick Hendrick Chevrolet',
      dealerCity: 'Charlotte',
      dealerState: 'NC',
    },
    ...overrides,
  };
}

function detail(overrides: Partial<DetailResponse> = {}): DetailResponse {
  return {
    id: 'listing-1',
    vin: '4T1B11HK5JU123456',
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    condition: 'used',
    price: 28990,
    miles: 41200,
    bodyType: 'SUV',
    exteriorColor: 'White',
    interiorColor: 'Black',
    drivetrain: 'AWD',
    engine: '2.5L I4',
    cityMpg: 27,
    highwayMpg: 34,
    seatingCapacity: 5,
    sellerComments: 'Call 803-555-0199 or sales@dealer.com',
    description: 'Visit https://rickhendrick.com',
    features: ['AWD', 'Call Rick Hendrick Chevrolet at 803-555-0199', 'Apple CarPlay'],
    photoUrls: ['https://cdn.dealer.example/rav4.jpg'],
    daysOnMarket: 12,
    location: {
      latitude: 35.21,
      longitude: -80.85,
      dealerName: 'Rick Hendrick Chevrolet',
      dealerCity: 'Charlotte',
      dealerState: 'NC',
      dealerPhone: '803-555-0199',
      dealerWebsite: 'https://www.rickhendrick.com',
      dealerAddress: '123 Hendrick Way, Charlotte, NC',
      dealerRating: 4.7,
      dealerReviewCount: 312,
    },
    enrichedAt: new Date().toISOString(),
    partial: false,
    loadedSections: ['listing'],
    ...overrides,
  };
}

test('search listings keep vehicle facts and drop dealer identity', () => {
  const listing = publicListingFromSearchVehicle(liveVehicle(), { latitude: 35.2271, longitude: -80.8431 });
  assert.ok(listing);
  const publicListing = assertPublicListing(listing);
  assert.equal(publicListing.id, 'listing-1');
  assert.equal(publicListing.vin, '4T1B11HK5JU123456');
  assert.equal(publicListing.inventory_type, 'used');
  assert.equal(publicListing.build.body_type, 'SUV');
  assert.equal(publicListing.car_location?.city, 'Charlotte');
  assert.equal(typeof publicListing.dist, 'number');
  assert.equal(JSON.stringify(publicListing).includes('Rick Hendrick'), false);
  assert.equal(JSON.stringify(publicListing).includes('dealerName'), false);
  assert.equal(JSON.stringify(publicListing).includes('dealer_name'), false);
  assert.equal(JSON.stringify(publicListing).includes('api_key'), false);
  assert.deepEqual(publicListing.media?.photo_links, ['https://cdn.dealer.example/rav4.jpg']);
  for (const bad of [
    'https://cdn.dealer.example/a.jpg?x-api-key=abc',
    'https://cdn.dealer.example/a.jpg?key=abc',
    'https://cdn.dealer.example/a.jpg?auth=abc',
    'https://cdn.dealer.example/a.jpg?client_secret=abc',
    'https://cdn.dealer.example/a.jpg?access_key=abc',
    'https://cdn.dealer.example/a.jpg?width=1;API_KEY=abc',
    'https://cdn.dealer.example/API_KEY/secret.jpg',
  ]) {
    const leaked = publicListingFromSearchVehicle(liveVehicle({ photoUrls: [bad], primaryPhotoUrl: bad }), { latitude: 35.2, longitude: -80.8 });
    const photos = leaked?.media?.photo_links ?? [];
    assert.equal(photos.includes(bad), false, bad);
    assert.equal(JSON.stringify(leaked).toLowerCase().includes('api_key'), false);
    assert.equal(JSON.stringify(leaked).toLowerCase().includes('secret'), false);
  }
  assert.equal(publicListingsContainForbiddenKey(publicListing), false);
  assert.deepEqual(Object.keys(publicListing).sort(), [
    'build',
    'car_location',
    'dist',
    'id',
    'inventory_type',
    'media',
    'miles',
    'msrp',
    'price',
    'vin',
  ]);
});

test('certified maps to cpo and VIN-less rows are dropped', () => {
  const certified = publicListingFromSearchVehicle(
    liveVehicle({ condition: 'certified' }),
    { latitude: 35.2, longitude: -80.8 },
  );
  assert.equal(certified?.inventory_type, 'cpo');
  assert.equal(
    publicListingFromSearchVehicle(liveVehicle({ vin: undefined }), { latitude: 35.2, longitude: -80.8 }),
    null,
  );
});

test('detail allow-list keeps specs and scrubs contact-shaped features', () => {
  const listing = publicListingFromDetail(detail());
  assert.ok(listing);
  assertPublicListing(listing);
  assert.equal(listing.build.drivetrain, 'AWD');
  assert.equal(listing.build.city_mpg, 27);
  assert.equal(listing.colors?.exterior_color, 'White');
  assert.equal(listing.dom_active, 12);
  assert.deepEqual(listing.extra?.features, ['AWD', 'Apple CarPlay']);
  const json = JSON.stringify(listing);
  assert.equal(json.includes('803-555-0199'), false);
  assert.equal(json.includes('sales@dealer.com'), false);
  assert.equal(json.includes('rickhendrick.com'), false);
  assert.equal(json.includes('Hendrick Way'), false);
  assert.equal(json.includes('loadedSections'), false);
  assert.equal(publicListingsContainForbiddenKey(listing), false);
});

test('an empty photo list falls back to the primary or cached thumbnail', () => {
  const origin = { latitude: 35.0071, longitude: -80.9398 };
  const primary = publicListingFromSearchVehicle(
    liveVehicle({
      photoUrls: [],
      primaryPhotoUrl: 'http://images.example-cdn.test/primary.jpg',
      thumbnailUrl: 'https://images.carsforsale.com/thumb.jpg',
    }),
    origin,
  );
  assert.deepEqual(primary?.media.photo_links, ['https://images.example-cdn.test/primary.jpg']);

  const cached = publicListingFromSearchVehicle(
    liveVehicle({
      photoUrls: [],
      primaryPhotoUrl: `https://cdn.dealer.example/a.jpg?api_key=${SECRET}`,
      thumbnailUrl: 'https://images.autodealersdigital.com/cached.jpg',
    }),
    origin,
  );
  assert.deepEqual(cached?.media.photo_links, ['https://images.autodealersdigital.com/cached.jpg']);
  assert.equal(JSON.stringify(cached).includes('api_key'), false);
  assert.equal(JSON.stringify(cached).includes('http://'), false);
});

test('photo-less listings sort after photos only at the same distance', () => {
  const origin = { latitude: 35.0071, longitude: -80.9398 };
  const near = { latitude: 35.006611, longitude: -80.946295 };
  const far = { latitude: 35.22, longitude: -80.84 };
  const row = (id: string, latitude: number, longitude: number, photo?: string) => publicListingFromSearchVehicle(
    liveVehicle({
      id,
      vin: id === 'near-blank' ? '3N6CM0KN2GK693924' : '1HGCM82633A004352',
      photoUrls: photo ? [photo] : [],
      primaryPhotoUrl: undefined,
      thumbnailUrl: photo,
      location: { latitude, longitude, dealerName: 'Example Independent Lot', dealerCity: 'Charlotte', dealerState: 'NC' },
    }),
    origin,
  );
  const blank = row('near-blank', near.latitude, near.longitude);
  const pictured = row('near-photo', near.latitude, near.longitude, 'https://images.inventoryrsc.com/a.jpg');
  const distant = row('far-photo', far.latitude, far.longitude, 'https://images.carsforsale.com/a.jpg');
  assert.ok(blank && pictured && distant);
  assert.equal(blank.dist, pictured.dist);
  assert.notEqual(blank.dist, distant.dist);
  assert.deepEqual(
    rankPhotoLessListingsLast([blank, distant, pictured]).map((listing) => listing.id),
    ['near-photo', 'near-blank', 'far-photo'],
  );
  assert.deepEqual(
    rankPhotoLessListingsLast([distant, blank]).map((listing) => listing.id),
    ['far-photo', 'near-blank'],
  );
  assert.equal(JSON.stringify([blank, pictured, distant]).includes('Example Independent'), false);
});

test('payloads with dealer keys are flagged', () => {
  assert.equal(publicListingsContainForbiddenKey({ dealer: { phone: '1' } }), true);
  assert.equal(publicListingsContainForbiddenKey({ vdp_url: 'https://dealer.example' }), true);
  assert.equal(publicListingsContainForbiddenKey({ id: 'x', vin: 'y' }), false);
});

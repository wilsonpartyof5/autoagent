import assert from 'node:assert/strict';
import test from 'node:test';

import type { DetailResponse, LiveVehicle } from '../marketcheck/mcp-adapter';

import {
  assertPublicListing,
  publicListingFromDetail,
  publicListingFromSearchVehicle,
  publicListingsContainForbiddenKey,
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

test('payloads with dealer keys are flagged', () => {
  assert.equal(publicListingsContainForbiddenKey({ dealer: { phone: '1' } }), true);
  assert.equal(publicListingsContainForbiddenKey({ vdp_url: 'https://dealer.example' }), true);
  assert.equal(publicListingsContainForbiddenKey({ id: 'x', vin: 'y' }), false);
});

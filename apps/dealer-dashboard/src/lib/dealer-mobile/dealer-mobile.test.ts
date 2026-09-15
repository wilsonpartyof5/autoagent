import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBearerToken } from './auth';
import {
  clampPageSize,
  leadBelongsToDealership,
  mapDelivery,
} from './leads';

const dealership = {
  id: 'ed8ba7f5-2d4c-4c08-82d4-7af3f2fc5464',
  name: 'Drevvy Motors',
  marketcheckDealerId: 'mc-123',
  marketcheckZip: '29730',
};

test('parseBearerToken accepts only a complete Bearer header', () => {
  assert.equal(parseBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(parseBearerToken('bearer token'), 'token');
  assert.equal(parseBearerToken('Basic token'), null);
  assert.equal(parseBearerToken('Bearer'), null);
  assert.equal(parseBearerToken(null), null);
});

test('leadBelongsToDealership prefers the rooftop UUID', () => {
  assert.equal(
    leadBelongsToDealership(
      { dealership_id: dealership.id, dealer_id: 'different' },
      dealership,
    ),
    true,
  );
  assert.equal(
    leadBelongsToDealership(
      { dealership_id: 'different', dealer_id: dealership.marketcheckDealerId },
      dealership,
    ),
    false,
  );
});

test('leadBelongsToDealership supports legacy dealer IDs', () => {
  assert.equal(
    leadBelongsToDealership(
      { dealership_id: null, dealer_id: dealership.marketcheckDealerId },
      dealership,
    ),
    true,
  );
});

test('clampPageSize keeps mobile list requests bounded', () => {
  assert.equal(clampPageSize(null), 100);
  assert.equal(clampPageSize('0'), 1);
  assert.equal(clampPageSize('20'), 20);
  assert.equal(clampPageSize('500'), 100);
});

test('mapDelivery converts database success to the iOS delivered state', () => {
  assert.deepEqual(
    mapDelivery({
      delivery_method: 'email',
      status: 'success',
      attempted_at: '2026-09-15T12:00:00.000Z',
      error_message: null,
    }),
    {
      method: 'Email · ADF/XML',
      state: 'delivered',
      attemptedAt: '2026-09-15T12:00:00.000Z',
    },
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { ShopperDealError } from './deals';
import { memoryOtdRequestRepository, requestOffNetworkOtd } from './otd-request';
import type { OnboardedRooftop } from '@/lib/dealer/rooftop-match';

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com',
};

test('an off-network listing records an OTD request once and does not open chat', async () => {
  const repo = memoryOtdRequestRepository();
  const rooftops = {
    listOnboardedRooftops: async () => [HONDA],
    loadListingIdentity: async () => ({
      listingId: 'mc-listing-9',
      listingUrl: 'https://www.cars.com/vehicledetail/9',
      dealerWebsite: 'https://independent.example',
      marketcheckDealerId: '555',
    }),
  };
  const first = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-10-27T12:00:00.000Z'),
    repo,
    rooftops,
  });
  assert.equal(first.created, true);
  assert.equal(first.request.listingId, 'mc-listing-9');
  assert.equal(first.request.dealerDomain, 'independent.example');
  assert.equal(first.request.marketcheckDealerId, '555');

  const again = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-10-27T13:00:00.000Z'),
    repo,
    rooftops,
  });
  assert.equal(again.created, false);
  assert.equal(again.request.id, first.request.id);
  assert.equal(repo.rows.length, 1);
});

test('an in-network listing cannot use the off-network OTD request', async () => {
  const repo = memoryOtdRequestRepository();
  await assert.rejects(
    () => requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-1' }, {
      now: new Date('2026-10-27T12:00:00.000Z'),
      repo,
      rooftops: {
        listOnboardedRooftops: async () => [HONDA],
        loadListingIdentity: async () => ({ marketcheckDealerId: '1038994' }),
      },
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'in_network',
  );
  assert.equal(repo.rows.length, 0);
});

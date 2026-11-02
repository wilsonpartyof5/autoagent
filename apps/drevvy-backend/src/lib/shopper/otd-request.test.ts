import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ShopperDealError } from './deals';
import { memoryOtdAnalytics } from './otd-analytics';
import {
  memoryOtdRequestRepository,
  otdRequestBodyFromHttp,
  requestOffNetworkOtd,
} from './otd-request';
import type { OnboardedRooftop } from '@/lib/dealer/rooftop-match';

const HERE = dirname(fileURLToPath(import.meta.url));

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com',
};

const OFF_NETWORK = {
  listOnboardedRooftops: async () => [HONDA],
  loadListingIdentity: async () => ({
    listingId: 'mc-listing-9',
    listingUrl: 'https://www.cars.com/vehicledetail/9',
    dealerWebsite: 'https://independent.example',
    marketcheckDealerId: '555',
  }),
};

test('an off-network listing records an OTD request once and does not open chat', async () => {
  const repo = memoryOtdRequestRepository();
  const first = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-10-27T12:00:00.000Z'),
    repo,
    rooftops: OFF_NETWORK,
  });
  assert.equal(first.created, true);
  assert.equal(first.request.listingId, 'mc-listing-9');
  assert.equal(first.request.dealerDomain, 'independent.example');
  assert.equal(first.request.marketcheckDealerId, '555');

  const again = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-10-27T13:00:00.000Z'),
    repo,
    rooftops: OFF_NETWORK,
  });
  assert.equal(again.created, false);
  assert.equal(again.request.id, first.request.id);
  assert.equal(repo.rows.length, 1);
});

test('a new off-network OTD writes the hashed twin and idempotent journey events', async () => {
  const repo = memoryOtdRequestRepository();
  const analytics = memoryOtdAnalytics();
  const first = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-11-02T12:00:00.000Z'),
    repo,
    rooftops: OFF_NETWORK,
    analytics,
  });
  assert.equal(first.created, true);
  assert.equal(analytics.twins.length, 1);
  assert.equal(analytics.twins[0]?.id, first.request.id);
  assert.equal(analytics.twins[0]?.userHash, 'hash:shopper-1');
  assert.notEqual(analytics.twins[0]?.userHash, 'shopper-1');
  assert.equal(analytics.twins[0]?.listingId, 'mc-listing-9');
  assert.equal(analytics.events.length, 2);
  assert.equal(analytics.events[0]?.eventType, 'otd_request.submitted');
  assert.equal(analytics.events[0]?.version, 1);
  assert.equal(analytics.events[0]?.idempotencyKey, `otd_request.submitted:${first.request.id}`);
  assert.deepEqual(analytics.events[0]?.payload, {
    otd_request_id: first.request.id,
    listing_id: 'mc-listing-9',
    dealer_domain: 'independent.example',
  });
  assert.equal('key_spend_id' in analytics.events[0]!.payload, false);
  assert.equal(analytics.events[1]?.eventType, 'cta.tapped');
  assert.deepEqual(analytics.events[1]?.payload, {
    cta_kind: 'request_otd',
    outcome: 'submitted_free',
    network_status: 'off_network',
  });

  const again = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-11-02T13:00:00.000Z'),
    repo,
    rooftops: OFF_NETWORK,
    analytics,
  });
  assert.equal(again.created, false);
  assert.equal(analytics.twins.length, 1);
  assert.equal(analytics.events.length, 2);
});

test('analytics failure after the app-table write still returns created=true', async () => {
  const repo = memoryOtdRequestRepository();
  const first = await requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-9' }, {
    now: new Date('2026-11-02T12:00:00.000Z'),
    repo,
    rooftops: OFF_NETWORK,
    analytics: {
      async recordSubmitted() {
        throw new Error('analytics down');
      },
    },
  });
  assert.equal(first.created, true);
  assert.equal(repo.rows.length, 1);
});

test('an in-network listing cannot use the off-network OTD request', async () => {
  const repo = memoryOtdRequestRepository();
  const analytics = memoryOtdAnalytics();
  await assert.rejects(
    () => requestOffNetworkOtd('shopper-1', { listingId: 'mc-listing-1' }, {
      now: new Date('2026-10-27T12:00:00.000Z'),
      repo,
      rooftops: {
        listOnboardedRooftops: async () => [HONDA],
        loadListingIdentity: async () => ({ marketcheckDealerId: '1038994' }),
      },
      analytics,
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'in_network',
  );
  assert.equal(repo.rows.length, 0);
  assert.equal(analytics.twins.length, 0);
  assert.equal(analytics.events.length, 0);
});

test('the iOS OTD alias body maps url onto listingUrl', () => {
  assert.deepEqual(
    otdRequestBodyFromHttp({ url: 'https://www.cars.com/vehicledetail/9', free: true }, 'mc-listing-9'),
    {
      url: 'https://www.cars.com/vehicledetail/9',
      free: true,
      listingId: 'mc-listing-9',
      listingUrl: 'https://www.cars.com/vehicledetail/9',
    },
  );
});

test('the canonical route and iOS alias both call requestOffNetworkOtd', () => {
  const canonical = readFileSync(join(HERE, '../../app/api/consumer/otd-requests/route.ts'), 'utf8');
  const alias = readFileSync(
    join(HERE, '../../app/api/consumer/listings/[id]/otd-request/route.ts'),
    'utf8',
  );
  assert.match(canonical, /postConsumerOtdRequest/);
  assert.match(alias, /postConsumerOtdRequest/);
  assert.match(alias, /listings\/:id\/otd-request/);
});

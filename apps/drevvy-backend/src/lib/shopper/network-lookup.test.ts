import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { marketCheckFailureReason, type ListingIdentityLookup } from '@/lib/dealer/rooftop-store';
import type { OnboardedRooftop } from '@/lib/dealer/rooftop-match';
import { publicShopperNetwork, resolveVdpCtas, type NetworkLookupDeps } from './vdp-ctas';

const HERE = dirname(fileURLToPath(import.meta.url));

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com/inventory',
};

const DEALER_URL = 'https://www.hondacarsorockhill.com/inventory/used/1';
const OTHER_DEALER = 'https://offnetwork.example/vdp/9';
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.shopper-jwt';

function deps(
  lookup: ListingIdentityLookup | Error,
  rooftops: OnboardedRooftop[] | Error = [HONDA],
  writes: { count: number } = { count: 0 },
): NetworkLookupDeps {
  return {
    lookupListingIdentity: async () => {
      if (lookup instanceof Error) throw lookup;
      return lookup;
    },
    listOnboardedRooftops: async () => {
      if (rooftops instanceof Error) throw rooftops;
      return rooftops;
    },
    loadListingIdentity: async () => {
      writes.count += 1;
      return null;
    },
  };
}

function assertClosed(state: string, ctas: { kind: string }[]) {
  assert.notEqual(state, 'off_network');
  assert.notEqual(state, 'in_network');
  assert.equal(ctas.some((cta) => cta.kind === 'off_network_otd_request'), false);
  assert.equal(ctas.some((cta) => cta.kind === 'dealer_conversation'), false);
}

test('verified in_network matches the MarketCheck dealer and hides dealer identity', async () => {
  const writes = { count: 0 };
  const lookup = await resolveVdpCtas(
    { listingId: 'mc-listing-1', listingUrl: OTHER_DEALER },
    deps({
      status: 'found',
      identity: {
        listingId: 'mc-listing-1',
        marketcheckDealerId: '1038994',
        dealerWebsite: 'https://www.hondacarsorockhill.com',
        listingUrl: DEALER_URL,
      },
    }, [HONDA], writes),
  );
  const body = JSON.stringify({ success: true, data: publicShopperNetwork(lookup), authorization: undefined });

  assert.equal(lookup.state, 'in_network');
  assert.deepEqual(lookup.ctas.map((cta) => cta.kind), ['market_intel', 'dealer_conversation']);
  assert.equal(writes.count, 0);
  assert.equal(body.includes('roof-honda'), false);
  assert.equal(body.includes('1038994'), false);
  assert.equal(body.includes(DEALER_URL), false);
  assert.equal(body.includes('hondacarsorockhill'), false);
  assert.equal(body.includes(JWT), false);
  assert.equal(body.includes('rooftopId'), false);
});

test('verified off_network is a real dealer miss and does not submit OTD', async () => {
  const writes = { count: 0 };
  const lookup = await resolveVdpCtas(
    { listingId: 'mc-listing-2', listingUrl: DEALER_URL },
    deps({
      status: 'found',
      identity: {
        listingId: 'mc-listing-2',
        marketcheckDealerId: '999',
        dealerWebsite: 'https://offnetwork.example',
      },
    }, [HONDA], writes),
  );

  assert.equal(lookup.state, 'off_network');
  assert.deepEqual(lookup.ctas.map((cta) => cta.kind), ['market_intel', 'off_network_otd_request']);
  assert.equal(writes.count, 0);
  const body = JSON.stringify(publicShopperNetwork(lookup));
  assert.equal(body.includes('999'), false);
  assert.equal(body.includes('offnetwork.example'), false);
  assert.equal(body.includes(DEALER_URL), false);
});

test('a listing with no dealer identity is unknown, even when the client sends a URL', async () => {
  let listed = false;
  const lookup = await resolveVdpCtas(
    { listingId: 'mc-listing-3', listingUrl: OTHER_DEALER },
    {
      lookupListingIdentity: async () => ({
        status: 'found',
        identity: { listingId: 'mc-listing-3' },
      }),
      listOnboardedRooftops: async () => {
        listed = true;
        return [HONDA];
      },
    },
  );

  assert.equal(lookup.state, 'unknown');
  assert.deepEqual(lookup.ctas, []);
  assert.equal(listed, false);
  assertClosed(lookup.state, lookup.ctas);
});

test('a request without a listing id is unknown and performs no lookup', async () => {
  let looked = false;
  const lookup = await resolveVdpCtas(
    { listingUrl: OTHER_DEALER },
    {
      lookupListingIdentity: async () => {
        looked = true;
        return { status: 'unavailable', reason: 'not_found' };
      },
      listOnboardedRooftops: async () => [HONDA],
    },
  );

  assert.equal(lookup.state, 'unknown');
  assert.equal(looked, false);
  assertClosed(lookup.state, lookup.ctas);
});

test('not found is identity_unavailable and never off_network', async () => {
  const lookup = await resolveVdpCtas(
    { listingId: 'missing-listing', listingUrl: OTHER_DEALER },
    deps({ status: 'unavailable', reason: 'not_found' }),
  );

  assert.equal(lookup.state, 'identity_unavailable');
  assert.deepEqual(lookup.ctas, []);
  assertClosed(lookup.state, lookup.ctas);
});

test('an upstream timeout or error is identity_unavailable and never off_network', async () => {
  const timeout = await resolveVdpCtas(
    { listingId: 'mc-listing-4', listingUrl: OTHER_DEALER },
    deps({ status: 'unavailable', reason: 'timeout' }),
  );
  const thrown = await resolveVdpCtas(
    { listingId: 'mc-listing-5' },
    deps(new Error('socket hang up')),
  );

  assert.equal(timeout.state, 'identity_unavailable');
  assert.equal(thrown.state, 'identity_unavailable');
  assert.deepEqual(timeout.ctas, []);
  assert.deepEqual(thrown.ctas, []);
  assert.equal(marketCheckFailureReason(Object.assign(new Error('aborted'), { name: 'AbortError' })), 'timeout');
  assert.equal(marketCheckFailureReason(new Error('connect ETIMEDOUT')), 'timeout');
  assert.equal(marketCheckFailureReason(new Error('boom')), 'error');
});

test('a rooftop-list failure is unknown and does not become off_network', async () => {
  const lookup = await resolveVdpCtas(
    { listingId: 'mc-listing-6' },
    deps(
      {
        status: 'found',
        identity: { listingId: 'mc-listing-6', marketcheckDealerId: '1038994' },
      },
      new Error('dealerships unavailable'),
    ),
  );

  assert.equal(lookup.state, 'unknown');
  assert.deepEqual(lookup.ctas, []);
  assertClosed(lookup.state, lookup.ctas);
});

test('the network route does not return a rooftop id or submit OTD', () => {
  const source = readFileSync(join(HERE, '../../app/api/consumer/listings/network/route.ts'), 'utf8');
  assert.match(source, /publicShopperNetwork/);
  assert.equal(source.includes('rooftopId'), false);
  assert.equal(source.includes('requestOffNetworkOtd'), false);
  assert.equal(source.includes('.insert('), false);
});

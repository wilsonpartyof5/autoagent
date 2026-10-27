import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ShopperDealError } from './deals';
import { ctasForMatch, readListingIdentityBody, resolveVdpCtas } from './vdp-ctas';
import { matchOnboardedRooftop, type OnboardedRooftop } from '@/lib/dealer/rooftop-match';

const HERE = dirname(fileURLToPath(import.meta.url));

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com',
};

test('in-network VDPs offer market intel and conversation, not an OTD request', () => {
  const match = matchOnboardedRooftop({ marketcheckDealerId: '1038994' }, [HONDA]);
  const set = ctasForMatch(match);
  assert.deepEqual(set.ctas.map((cta) => cta.kind), ['market_intel', 'dealer_conversation']);
  assert.equal(set.ctas.every((cta) => cta.keyCost === 1), true);
  assert.equal(set.network, 'in_network');
});

test('off-network VDPs offer market intel and an OTD request, not conversation', () => {
  const match = matchOnboardedRooftop({ listingUrl: 'https://cars.com/vdp/1' }, [HONDA]);
  const set = ctasForMatch(match);
  assert.deepEqual(set.ctas.map((cta) => cta.kind), ['market_intel', 'off_network_otd_request']);
  assert.equal(set.ctas.find((cta) => cta.kind === 'off_network_otd_request')?.keyCost, 0);
  assert.equal(set.network, 'off_network');
});

test('resolveVdpCtas uses onboarded rooftops and listing identity', async () => {
  const inNetwork = await resolveVdpCtas({ listingId: 'mc-listing-1' }, {
    listOnboardedRooftops: async () => [HONDA],
    loadListingIdentity: async () => ({
      listingId: 'mc-listing-1',
      marketcheckDealerId: '1038994',
      dealerWebsite: 'https://www.hondacarsorockhill.com',
    }),
  });
  assert.equal(inNetwork.network, 'in_network');
  assert.equal(inNetwork.match.matched, true);

  const offNetwork = await resolveVdpCtas({ listingUrl: 'https://www.cars.com/vehicledetail/x' }, {
    listOnboardedRooftops: async () => [HONDA],
  });
  assert.equal(offNetwork.network, 'off_network');
});

test('a listing identity body needs a listing id or URL', () => {
  assert.deepEqual(readListingIdentityBody({ listingId: 'mc-listing-1' }), {
    listingId: 'mc-listing-1',
    listingUrl: null,
  });
  assert.throws(
    () => readListingIdentityBody({}),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'invalid_request',
  );
});

test('the network and conversation routes exist', () => {
  const network = readFileSync(join(HERE, '../../app/api/consumer/listings/network/route.ts'), 'utf8');
  const conversation = readFileSync(join(HERE, '../../app/api/consumer/keys/conversation/route.ts'), 'utf8');
  const otd = readFileSync(join(HERE, '../../app/api/consumer/otd-requests/route.ts'), 'utf8');
  assert.match(network, /requireShopperAuth/);
  assert.match(network, /resolveVdpCtas/);
  assert.match(conversation, /startDealerConversation/);
  assert.match(otd, /requestOffNetworkOtd/);
});

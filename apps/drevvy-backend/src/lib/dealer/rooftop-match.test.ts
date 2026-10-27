import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  IN_NETWORK_CHANNEL,
  IN_NETWORK_OPENER,
  inNetworkOpener,
  matchOnboardedRooftop,
  mergeListingIdentity,
  normalizeHost,
  normalizeListingUrl,
  normalizeMarketcheckDealerId,
  shopperFirstNameOnly,
  type OnboardedRooftop,
} from './rooftop-match';

const HERE = dirname(fileURLToPath(import.meta.url));

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com',
};

const PATH_ROOF: OnboardedRooftop = {
  id: 'roof-path',
  name: 'Group Store',
  marketcheckDealerId: '2002',
  websiteUrl: 'https://www.group.com/rock-hill',
};

test('normalizeHost strips protocol, www, trailing dots, and default ports', () => {
  assert.equal(normalizeHost('https://www.HondaCarsOfRockHill.com/inventory/tahoe'), 'hondacarsofrockhill.com');
  assert.equal(normalizeHost('HondaCarsOfRockHill.com.'), 'hondacarsofrockhill.com');
  assert.equal(normalizeHost('http://www.hondacarsorockhill.com:80/'), 'hondacarsorockhill.com');
  assert.equal(normalizeHost(''), null);
  assert.equal(normalizeHost('not a url'), null);
});

test('normalizeListingUrl drops query, hash, and trailing slash', () => {
  assert.equal(
    normalizeListingUrl('https://www.hondacarsorockhill.com/inventory/2024-tahoe/?utm=x#top'),
    'hondacarsorockhill.com/inventory/2024-tahoe',
  );
  assert.equal(normalizeListingUrl('https://www.hondacarsorockhill.com/'), 'hondacarsorockhill.com');
  assert.equal(normalizeMarketcheckDealerId(1038994), '1038994');
  assert.equal(normalizeMarketcheckDealerId(' 1038994 '), '1038994');
  assert.equal(normalizeMarketcheckDealerId(''), null);
});

test('MarketCheck dealer id matches an onboarded rooftop first', () => {
  const match = matchOnboardedRooftop({
    listingUrl: 'https://cars.com/vehicledetail/abc',
    dealerWebsite: 'https://other.com',
    marketcheckDealerId: 1038994,
  }, [HONDA, PATH_ROOF]);
  assert.equal(match.matched, true);
  if (!match.matched) return;
  assert.equal(match.method, 'marketcheck_dealer_id');
  assert.equal(match.rooftop.id, 'roof-honda');
  assert.equal(match.network, 'in_network');
  assert.equal(match.channel, IN_NETWORK_CHANNEL);
  assert.equal(match.shopperKnown, true);
  assert.equal(match.opener, IN_NETWORK_OPENER);
});

test('a VDP URL on the rooftop domain is in-network without a MarketCheck id', () => {
  const match = matchOnboardedRooftop({
    listingUrl: 'https://hondacarsorockhill.com/used/2024-honda-cr-v/',
  }, [HONDA]);
  assert.equal(match.matched, true);
  if (!match.matched) return;
  assert.equal(match.method, 'listing_url');
  assert.equal(match.rooftop.id, 'roof-honda');
});

test('dealer website domain matches when the VDP is on an aggregator', () => {
  const match = matchOnboardedRooftop({
    listingUrl: 'https://www.cars.com/vehicledetail/abc',
    dealerWebsite: 'https://www.hondacarsorockhill.com',
  }, [HONDA]);
  assert.equal(match.matched, true);
  if (!match.matched) return;
  assert.equal(match.method, 'dealer_domain');
});

test('a rooftop website path only matches VDPs under that path', () => {
  const hit = matchOnboardedRooftop({
    listingUrl: 'https://www.group.com/rock-hill/inventory/civic',
  }, [PATH_ROOF]);
  assert.equal(hit.matched, true);
  if (!hit.matched) return;
  assert.equal(hit.method, 'listing_url');

  const miss = matchOnboardedRooftop({
    listingUrl: 'https://www.group.com/charlotte/inventory/civic',
  }, [PATH_ROOF]);
  assert.equal(miss.matched, false);
  assert.equal(miss.network, 'off_network');
});

test('an aggregator VDP with no rooftop domain or MarketCheck id is off-network', () => {
  const match = matchOnboardedRooftop({
    listingId: 'mc-listing-1',
    listingUrl: 'https://www.cars.com/vehicledetail/abc',
    dealerWebsite: 'https://independent-motors.example',
    marketcheckDealerId: '999',
  }, [HONDA]);
  assert.equal(match.matched, false);
  assert.equal(match.network, 'off_network');
  assert.equal(match.channel, null);
  assert.equal(match.shopperKnown, false);
});

test('no onboarded rooftops means off-network', () => {
  const match = matchOnboardedRooftop({
    marketcheckDealerId: '1038994',
    dealerWebsite: 'https://www.hondacarsorockhill.com',
  }, []);
  assert.equal(match.network, 'off_network');
});

test('mergeListingIdentity prefers the first non-empty field', () => {
  const merged = mergeListingIdentity(
    { listingId: 'mc-1' },
    { listingUrl: 'https://hondacarsorockhill.com/vdp/1', marketcheckDealerId: '1038994' },
    { dealerWebsite: 'https://www.hondacarsorockhill.com', marketcheckDealerId: 'other' },
  );
  assert.deepEqual(merged, {
    listingId: 'mc-1',
    listingUrl: 'https://hondacarsorockhill.com/vdp/1',
    marketcheckDealerId: '1038994',
    dealerWebsite: 'https://www.hondacarsorockhill.com',
  });
});

test('the opener is message-only and asks for itemized OTD at signup terms', () => {
  assert.match(IN_NETWORK_OPENER, /itemized best out-the-door/);
  assert.match(IN_NETWORK_OPENER, /signup terms/);
  assert.match(IN_NETWORK_OPENER, /A shopper is asking in Drevvy chat/);
  assert.equal(/sms|email|call|telnyx/i.test(IN_NETWORK_OPENER), false);
  assert.equal(IN_NETWORK_CHANNEL, 'in_app_message');
});

test('in-network dealers see first name only', () => {
  assert.equal(shopperFirstNameOnly('Dana Blake'), 'Dana');
  assert.equal(shopperFirstNameOnly('  Dana  '), 'Dana');
  assert.equal(shopperFirstNameOnly('dana@example.com'), null);
  assert.equal(shopperFirstNameOnly('555-1212'), null);
  assert.equal(shopperFirstNameOnly('Dana123'), null);
  assert.match(inNetworkOpener('Dana Blake'), /^Dana is asking in Drevvy chat/);
  assert.equal(/Blake|@|555/.test(inNetworkOpener('Dana Blake')), false);
});

test('DEALER.md documents the match function', () => {
  const doc = readFileSync(join(HERE, '../../../DEALER.md'), 'utf8');
  assert.match(doc, /matchOnboardedRooftop/);
  assert.match(doc, /user_dealerships/);
  assert.match(doc, /off-network/i);
  assert.match(doc, /in_app_message/);
  assert.match(doc, /confirmed delivery/i);
  assert.match(doc, /\$300/);
  assert.match(doc, /first name only/i);
  assert.match(doc, /generic keys/i);
});

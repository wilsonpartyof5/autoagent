import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import type { OnboardedRooftop } from './rooftop-match';
import {
  analyticsMatchMethod,
  recordInNetworkVdpMatch,
  VDP_MATCHER_VERSION,
  vdpUrlHash,
} from './vdp-match';

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsorockhill.com',
};

test('Analytics match_method maps from the rooftop matcher', () => {
  assert.equal(analyticsMatchMethod('listing_url'), 'exact_url');
  assert.equal(analyticsMatchMethod('dealer_domain'), 'domain');
  assert.equal(analyticsMatchMethod('marketcheck_dealer_id'), 'dealer_map');
});

test('vdpUrlHash is sha256 of the listing URL, or listing id when the URL is missing', () => {
  const url = 'https://www.hondacarsorockhill.com/vdp/1';
  assert.equal(vdpUrlHash(url, 'mc-1'), createHash('sha256').update(url.toLowerCase()).digest('hex'));
  assert.equal(vdpUrlHash(null, 'mc-1'), createHash('sha256').update('listing:mc-1').digest('hex'));
  assert.equal(VDP_MATCHER_VERSION, 'drevvy-backend-1');
});

test('recordInNetworkVdpMatch writes an in-network rooftop row', async () => {
  const inserted: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'drevvy_vdp_matches');
      return {
        insert: (data: Record<string, unknown>) => {
          inserted.push(data);
          return {
            select: () => ({
              single: async () => ({ data: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, error: null }),
            }),
          };
        },
      };
    },
  };

  const id = await recordInNetworkVdpMatch(supabase as never, {
    listingId: 'mc-listing-1',
    listingUrl: 'https://www.hondacarsorockhill.com/vdp/1',
    match: {
      matched: true,
      network: 'in_network',
      rooftop: HONDA,
      method: 'marketcheck_dealer_id',
      channel: 'in_app_message',
      shopperKnown: true,
      opener: 'Dana wants your best itemized out-the-door',
    },
  });

  assert.equal(id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.equal(inserted[0]?.listing_id, 'mc-listing-1');
  assert.equal(inserted[0]?.dealership_id, HONDA.id);
  assert.equal(inserted[0]?.network_status, 'in_network');
  assert.equal(inserted[0]?.match_method, 'dealer_map');
  assert.equal(inserted[0]?.matcher_version, VDP_MATCHER_VERSION);
});

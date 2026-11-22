import assert from 'node:assert/strict';
import test from 'node:test';

import { marketCheckStoredKeyCount, resetMarketCheckCacheForTests } from './cache-policy';
import {
  fairPriceTriggerAllowed,
  loadFairPriceIfAllowed,
  resetFairPriceGuardsForTests,
} from './price';
import { containsSecret } from './secrets';
import { resetMarketCheckUsageForTests } from './usage';

const SECRET = 'test-marketcheck-key-do-not-ship';
const VIN = '1HGCM82633A004352';
const ZIP = '29730';

test('fair price loads only for unlock with agent or opening a deal, then uses the 24 hour cache', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const previousSpend = process.env.FAIR_PRICE_SPEND_ENABLED;
  process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
  resetMarketCheckCacheForTests();
  resetFairPriceGuardsForTests();
  resetMarketCheckUsageForTests();
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  let calls = 0;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      params: { name: string; arguments: { dealer_type?: string } };
    };
    assert.equal(body.params.name, 'predict_price_with_comparables');
    assert.equal(body.params.arguments.dealer_type, 'franchise');
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: JSON.stringify({
        success: true,
        data: { marketcheck_price: 30100, comparables: { listings: [] } },
      }) }] },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    assert.equal(fairPriceTriggerAllowed('unlock_with_agent'), true);
    assert.equal(fairPriceTriggerAllowed('open_deal'), true);
    assert.equal(fairPriceTriggerAllowed('listing'), false);
    assert.equal(fairPriceTriggerAllowed('search'), false);
    assert.equal(fairPriceTriggerAllowed('history'), false);
    assert.equal(fairPriceTriggerAllowed('vin'), false);

    const vehicle = { vin: VIN, miles: 41000, zip: ZIP, condition: 'used' as const };
    const paid = { userId: 'shopper-fair-price' };
    assert.equal(await loadFairPriceIfAllowed('listing', vehicle, paid), null);
    assert.equal(await loadFairPriceIfAllowed('unlock_with_agent', { ...vehicle, condition: 'new' }, paid), null);
    assert.equal(await loadFairPriceIfAllowed('open_deal', { ...vehicle, zip: undefined }, paid), null);
    assert.equal(calls, 0);

    const unlocked = await loadFairPriceIfAllowed('unlock_with_agent', vehicle, paid);
    const opened = await loadFairPriceIfAllowed('open_deal', { ...vehicle, zip: `${ZIP}-1234` }, paid);
    assert.equal(unlocked?.price, 30100);
    assert.equal(unlocked?.fromCache, false);
    assert.equal(opened?.price, 30100);
    assert.equal(opened?.fromCache, true);
    assert.equal(calls, 1);
    assert.equal(marketCheckStoredKeyCount(), 1);

    const joined = logs.join('\n');
    assert.equal(joined.includes('"endpoint":"predict_price_with_comparables"'), true);
    assert.equal(joined.includes('"count":1'), true);
    assert.equal((joined.match(/"endpoint":"predict_price_with_comparables"/g) ?? []).length, 1);
    assert.equal(joined.includes('get_marketcheck_price'), false);
    assert.equal(joined.includes(VIN), false);
    assert.equal(joined.includes(ZIP), false);
    assert.equal(containsSecret(joined), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    if (previousSpend === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
    else process.env.FAIR_PRICE_SPEND_ENABLED = previousSpend;
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function readApp(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8');
}

const INVENTORY_ROUTES = [
  'src/app/api/inventory/search/route.ts',
  'src/app/api/inventory/detail/[id]/route.ts',
  'src/app/api/query/chat-search/route.ts',
];

const SHOPPER_ROUTES = [
  'src/app/api/consumer/keys/market-save/route.ts',
  'src/app/api/consumer/saved-cars/route.ts',
];

test('existing inventory and chat-search routes still reject missing API keys', () => {
  for (const relative of INVENTORY_ROUTES) {
    const source = readApp(relative);
    assert.match(source, /function validateApiKey/);
    assert.match(source, /INVENTORY_SEARCH_API_KEY/);
    assert.match(source, /status: 401/);
    assert.match(source, /if \(!validateApiKey\(request\)\)/);
    const authIndex = source.indexOf('if (!validateApiKey(request))');
    const callSites = [
      source.indexOf('searchLiveInventory({'),
      source.indexOf('getVehicleDetailMcp('),
      source.indexOf('parseQueryWithOpenAI('),
    ].filter((index) => index >= 0);
    assert.ok(authIndex >= 0, `${relative} must call validateApiKey`);
    assert.ok(callSites.length > 0, `${relative} must still call the upstream after auth`);
    assert.ok(callSites.every((index) => index > authIndex), `${relative} must auth-check before MarketCheck or LLM`);
  }
});

test('MI/save and saved-cars still require a shopper JWT and reject the shared key', () => {
  for (const relative of SHOPPER_ROUTES) {
    const source = readApp(relative);
    assert.match(source, /requireShopperAuth/);
    assert.doesNotMatch(source, /validateApiKey/);
  }
  const session = readApp('src/lib/shopper/session.ts');
  assert.match(session, /shared_key_rejected/);
  assert.match(session, /INVENTORY_SEARCH_API_KEY/);
  const auth = readApp('src/lib/consumer/auth.ts');
  assert.match(auth, /shared_key_rejected/);
});

test('dealer and admin gates stay in front of those APIs', () => {
  const dealer = readApp('src/app/api/dealer/v1/session/route.ts');
  assert.match(dealer, /withDealerApi/);
  const inbox = readApp('src/app/api/dealer/v1/inbox/route.ts');
  assert.match(inbox, /withDealerApi|requireDealerApi/);
  const admin = readApp('src/app/api/admin/shoppers/route.ts');
  assert.match(admin, /requireAdminApi/);
});

test('public Discover routes do not require the shared inventory key or shopper JWT', () => {
  const search = readApp('src/app/api/public/discover/search/route.ts');
  const detail = readApp('src/app/api/public/discover/listings/[id]/route.ts');
  for (const source of [search, detail]) {
    assert.doesNotMatch(source, /validateApiKey/);
    assert.doesNotMatch(source, /INVENTORY_SEARCH_API_KEY/);
    assert.doesNotMatch(source, /requireShopperAuth/);
    assert.doesNotMatch(source, /requireConsumerAuth/);
    assert.match(source, /handleDiscover(Search|Listing)/);
  }
  const handlers = readApp('src/lib/public-discover/handlers.ts');
  assert.match(handlers, /enforceDiscoverRateLimit/);
  assert.doesNotMatch(handlers, /DemoRepository|demoListings|demo-vehicles/);
});

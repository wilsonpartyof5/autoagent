import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { DEFAULT_OPENAI_FALLBACK_MODEL, DEFAULT_OPENAI_MODEL } from '../brain/config';
import {
  SHOPPING_GATEWAY_BASE_URL,
  SHOPPING_MODEL,
  shoppingGatewayCredential,
} from './shopping-llm';

const here = dirname(fileURLToPath(import.meta.url));

test('Ask/Shop uses the cheapest interactive GPT-6 on the AI Gateway', () => {
  assert.equal(SHOPPING_MODEL, 'openai/gpt-6-luna');
  assert.equal(SHOPPING_GATEWAY_BASE_URL, 'https://ai-gateway.vercel.sh/v1');
  assert.equal(SHOPPING_MODEL.includes('-batch'), false);
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-6-astra');
  assert.equal(DEFAULT_OPENAI_FALLBACK_MODEL, 'gpt-6.1-sol');
});

test('shopping auth is the gateway credential, not the dealer brain key', () => {
  assert.equal(shoppingGatewayCredential({ OPENAI_API_KEY: 'sk-brain', OPENAI_MODEL: 'gpt-6-astra' }), undefined);
  assert.equal(shoppingGatewayCredential({ AI_GATEWAY_API_KEY: ' gw-key ' }), 'gw-key');
  assert.equal(
    shoppingGatewayCredential({ VERCEL_OIDC_TOKEN: 'oidc', AI_GATEWAY_API_KEY: '' }),
    'oidc',
  );
});

test('the shopper parse, facet match, and reply all call the shopping model', () => {
  const files = [
    join(here, 'parse-inventory-query.ts'),
    join(here, 'resolve-canonical-filters.ts'),
    join(here, '../../app/api/query/chat-search/route.ts'),
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /SHOPPING_MODEL/);
    assert.equal(source.includes('gpt-5-mini'), false);
    assert.equal(source.includes('gpt-4o-mini'), false);
    assert.equal(source.includes('gpt-6-astra'), false);
  }
});

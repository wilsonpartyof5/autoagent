import assert from 'node:assert/strict';
import test from 'node:test';

import { discoverClientIp } from './client-ip';

test('x-forwarded-for still identifies the client when Vercel has not set its own header', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.10, 10.0.0.4' });
  assert.equal(discoverClientIp(headers), '203.0.113.10');
});

test('a platform x-vercel-forwarded-for wins over a rewritten x-forwarded-for', () => {
  const headers = new Headers({
    'x-forwarded-for': '198.51.100.9, 203.0.113.10',
    'x-vercel-forwarded-for': '203.0.113.10',
  });
  assert.equal(discoverClientIp(headers), '203.0.113.10');
});

test('missing forwarding headers share one unknown bucket', () => {
  assert.equal(discoverClientIp(new Headers()), 'unknown');
});

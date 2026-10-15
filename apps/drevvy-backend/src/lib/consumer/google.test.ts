import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, type JsonWebKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ConsumerAuthError } from './auth';
import { GOOGLE_NOT_CONFIGURED, readGoogleClientIds, verifyGoogleIdToken } from './google';

const HERE = dirname(fileURLToPath(import.meta.url));
const IOS = 'ios-client.apps.googleusercontent.com';
const WEB = 'web-client.apps.googleusercontent.com';
const NOW = new Date('2026-10-14T12:00:00.000Z');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey & { kid?: string };
jwk.kid = 'google-test-key';
jwk.alg = 'RS256';
jwk.use = 'sig';

function sign(claims: Record<string, unknown>, kid = 'google-test-key'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: IOS,
    exp: Math.floor(NOW.getTime() / 1000) + 3600,
    sub: 'google-shopper-1',
    email: 'shopper@gmail.com',
    ...overrides,
  };
}

function verify(token: string, nonce?: string, clientIds = [IOS, WEB]) {
  return verifyGoogleIdToken({
    identityToken: token,
    nonce,
    clientIds,
    now: NOW,
    fetchJwks: async () => [jwk],
  });
}

test('google client ids are required and comma-separated', () => {
  assert.throws(
    () => readGoogleClientIds(undefined),
    (error: unknown) => error instanceof ConsumerAuthError
      && error.status === 503
      && error.message === GOOGLE_NOT_CONFIGURED,
  );
  assert.throws(
    () => readGoogleClientIds('  '),
    (error: unknown) => error instanceof ConsumerAuthError && error.message === GOOGLE_NOT_CONFIGURED,
  );
  assert.deepEqual(readGoogleClientIds(` ${IOS}, ${WEB} `), [IOS, WEB]);
});

test('a Google ID token must match iss, aud, and exp', async () => {
  const ok = await verify(sign(claims()));
  assert.deepEqual(ok, { sub: 'google-shopper-1' });
  assert.equal(JSON.stringify(ok).includes('gmail'), false);

  await assert.rejects(
    () => verify(sign(claims({ aud: 'other-client.apps.googleusercontent.com' }))),
    (error: unknown) => error instanceof ConsumerAuthError && error.code === 'google_rejected',
  );
  await assert.rejects(
    () => verify(sign(claims({ iss: 'https://appleid.apple.com' }))),
    (error: unknown) => error instanceof ConsumerAuthError && error.code === 'google_rejected',
  );
  await assert.rejects(
    () => verify(sign(claims({ exp: Math.floor(NOW.getTime() / 1000) - 1 }))),
    (error: unknown) => error instanceof ConsumerAuthError && error.code === 'google_rejected',
  );
  await assert.rejects(
    () => verify(sign(claims(), 'other-key')),
    (error: unknown) => error instanceof ConsumerAuthError && error.code === 'google_rejected',
  );

  const accountsIssuer = await verify(sign(claims({ iss: 'accounts.google.com', aud: [WEB] })));
  assert.equal(accountsIssuer.sub, 'google-shopper-1');
});

test('the nonce matches the raw value or its SHA-256', async () => {
  const { createHash } = await import('node:crypto');
  const nonce = 'shopper-nonce';
  const hashed = createHash('sha256').update(nonce).digest('hex');
  assert.equal((await verify(sign(claims({ nonce })), nonce)).sub, 'google-shopper-1');
  assert.equal((await verify(sign(claims({ nonce: hashed })), nonce)).sub, 'google-shopper-1');
  await assert.rejects(
    () => verify(sign(claims({ nonce: 'other' })), nonce),
    (error: unknown) => error instanceof ConsumerAuthError && error.code === 'google_rejected',
  );
});

test('google shoppers skip the dealer profile and keep the consumer profile path', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/auth/google/route.ts'), 'utf8');
  const apple = readFileSync(join(HERE, '../../app/api/consumer/auth/apple/route.ts'), 'utf8');
  assert.match(route, /provider: 'google'/);
  assert.match(route, /signInWithIdToken/);
  assert.match(route, /ensureConsumerProfile/);
  assert.match(route, /publicConsumerSession/);
  assert.match(route, /GOOGLE_OAUTH_CLIENT_IDS/);
  assert.match(route, /verifyGoogleIdToken/);
  assert.equal(route.includes('identityToken'), true);
  assert.equal(route.includes('nonce'), true);
  assert.equal(/negotiat/i.test(route), false);

  const profile = readFileSync(join(HERE, 'auth.ts'), 'utf8');
  const ensure = profile.slice(profile.indexOf('export async function ensureConsumerProfile'));
  assert.match(ensure, /consumer_profiles/);
  assert.equal(ensure.includes("provider' === 'apple'"), false);
  assert.equal(ensure.includes('google'), false);

  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261017123700_google_shoppers.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /in \('apple', 'google'\)/);
  assert.match(sql, /insert into public\.profiles/);
  assert.match(sql, /revoke execute on function public\.handle_new_user\(\)/);
  assert.equal(sql.includes('shopper_credits'), false);
  assert.equal(sql.includes('consumer_profiles'), false);
  const version = '20261017123700';
  assert.equal(version.length, 14);
  assert.equal(version > '20261017000001', true);

  assert.match(apple, /provider: 'apple'/);
  assert.match(apple, /publicConsumerSession/);
});

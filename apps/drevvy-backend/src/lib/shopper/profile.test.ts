import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PROFILE_RESPONSE_KEYS,
  presentProfile,
  ProfileError,
  profileColumns,
  readProfilePatch,
} from './profile';

const HERE = dirname(fileURLToPath(import.meta.url));

test('profile keeps a first name and ZIP and rejects contact fields', () => {
  assert.deepEqual(readProfilePatch({ firstName: 'Dana Blake', zip: '62701-1234' }), {
    firstName: 'Dana',
    zip: '62701',
  });
  assert.deepEqual(readProfilePatch({ firstName: '' }), { firstName: null });
  assert.deepEqual(readProfilePatch({ zip: null }), { zip: null });

  assert.throws(
    () => readProfilePatch({ firstName: 'Dana', email: 'dana@example.com' }),
    (error: unknown) => error instanceof ProfileError && error.code === 'profile_field_rejected',
  );
  assert.throws(
    () => readProfilePatch({ phone: '555-0100' }),
    (error: unknown) => error instanceof ProfileError && error.code === 'profile_field_rejected',
  );
  assert.throws(
    () => readProfilePatch({ firstName: 'dana@example.com' }),
    (error: unknown) => error instanceof ProfileError && error.code === 'invalid_first_name',
  );
  assert.throws(
    () => readProfilePatch({ firstName: '555-1212' }),
    (error: unknown) => error instanceof ProfileError && error.code === 'invalid_first_name',
  );
  assert.throws(
    () => readProfilePatch({ zip: '12' }),
    (error: unknown) => error instanceof ProfileError && error.code === 'invalid_zip',
  );

  const profile = presentProfile({
    userId: 'shopper-1',
    status: 'active',
    firstName: 'Dana Blake',
    zip: '62701',
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  });
  assert.equal(profile.firstName, 'Dana');
  assert.equal(profile.zip, '62701');
  assert.deepEqual(Object.keys(profile), [...PROFILE_RESPONSE_KEYS]);
  assert.equal(JSON.stringify(profile).includes('email'), false);
  assert.equal(JSON.stringify(profile).includes('phone'), false);
});

test('the profile route returns only the public profile columns', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/profile/route.ts'), 'utf8');
  assert.match(route, /requireConsumerAuth/);
  assert.match(route, /createAdminClient/);
  assert.match(route, /profileColumns/);
  assert.match(route, /\.eq\('user_id', auth\.userId\)/);
  assert.equal(route.includes('email'), false);
  assert.equal(route.includes('phone'), false);
  assert.equal(profileColumns(), 'user_id, status, first_name, zip, created_at, updated_at');
});

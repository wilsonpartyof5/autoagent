import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PROFILE_RESPONSE_KEYS,
  isMissingZipColumn,
  presentProfile,
  ProfileError,
  profileColumns,
  readProfilePatch,
  readProfileRow,
  writeProfileRow,
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
  assert.match(route, /readProfileRow/);
  assert.match(route, /writeProfileRow/);
  assert.match(route, /\.eq\('user_id', auth\.userId\)/);
  assert.equal(route.includes('email'), false);
  assert.equal(route.includes('phone'), false);
  assert.equal(profileColumns(), 'user_id, status, first_name, zip, created_at, updated_at');
  assert.equal(profileColumns({ zip: false }), 'user_id, status, first_name, created_at, updated_at');
});

test('a missing zip column still returns the profile and still saves a first name', async () => {
  const row = {
    user_id: 'shopper-1',
    status: 'active',
    first_name: 'Dana',
    created_at: '2026-11-05T00:00:00.000Z',
    updated_at: '2026-11-05T00:00:00.000Z',
  };
  const missing = { code: 'PGRST204', message: "Could not find the 'zip' column of 'consumer_profiles' in the schema cache" };
  assert.equal(isMissingZipColumn(missing), true);
  assert.equal(isMissingZipColumn({ code: '23514', message: 'consumer_profiles_zip_check' }), false);

  const selects: string[] = [];
  const read = await readProfileRow(async (columns) => {
    selects.push(columns);
    if (columns.includes('zip')) return { data: null, error: missing };
    return { data: row, error: null };
  });
  assert.deepEqual(selects, [
    'user_id, status, first_name, zip, created_at, updated_at',
    'user_id, status, first_name, created_at, updated_at',
  ]);
  const profile = presentProfile({
    userId: 'shopper-1',
    status: 'active',
    firstName: (read as { first_name?: string }).first_name ?? null,
    zip: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  assert.equal(profile.firstName, 'Dana');
  assert.equal(profile.zip, null);
  assert.equal(profile.consumerUserId, 'shopper-1');

  const writes: Array<{ values: Record<string, unknown>; columns: string }> = [];
  const written = await writeProfileRow(async (values, columns) => {
    writes.push({ values, columns });
    if (columns.includes('zip') || 'zip' in values) return { data: null, error: missing };
    return { data: { ...row, first_name: values.first_name }, error: null };
  }, { firstName: 'Dana', zip: '62701' });
  assert.equal(writes.length, 2);
  assert.equal('zip' in writes[1].values, false);
  assert.equal((written as { first_name?: string }).first_name, 'Dana');
});

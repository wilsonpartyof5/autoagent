import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  RooftopDirectoryUnavailable,
  loadOnboardedRooftops,
  onboardedColumnMissing,
} from './rooftop-store';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
};

function thenable(result: QueryResult) {
  const builder = {
    select() {
      return builder;
    },
    then(
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}

function client(script: {
  memberships: QueryResult;
  bySelect: Record<string, QueryResult>;
  selects?: string[];
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'user_dealerships') return thenable(script.memberships);
      let columns = '';
      const builder = {
        select(cols: string) {
          columns = cols;
          script.selects?.push(cols);
          return builder;
        },
        in() {
          return builder;
        },
        not() {
          return builder;
        },
        then(
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          const result = script.bySelect[columns] ?? {
            data: null,
            error: { message: `unexpected select ${columns}` },
          };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const MEMBERSHIPS = {
  data: [{ dealership_id: 'roof-on' }, { dealership_id: 'roof-off' }],
  error: null,
};

test('onboardedColumnMissing only matches a missing onboarded_at column', () => {
  assert.equal(onboardedColumnMissing({
    code: 'PGRST204',
    message: "Could not find the 'onboarded_at' column of 'dealerships' in the schema cache",
  }), true);
  assert.equal(onboardedColumnMissing({
    code: '42703',
    message: 'column dealerships.onboarded_at does not exist',
  }), true);
  assert.equal(onboardedColumnMissing({
    code: '42501',
    message: 'permission denied for table dealerships',
  }), false);
  assert.equal(onboardedColumnMissing({
    message: 'column dealerships.name does not exist',
  }), false);
});

test('rooftop-store has no membership-only fallback', () => {
  const source = readFileSync(new URL('./rooftop-store.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('membership-only'), false);
  assert.equal(source.includes('onboarded_column_missing'), false);
  assert.equal(
    source.includes(".select('id, name, marketcheck_dealer_id, marketcheck_website_url')"),
    false,
  );
});

test('loadOnboardedRooftops drops memberships whose rooftop is not onboarded', async () => {
  const rooftops = await loadOnboardedRooftops(client({
    memberships: MEMBERSHIPS,
    bySelect: {
      'id, name, marketcheck_dealer_id, marketcheck_website_url, onboarded_at': {
        data: [
          {
            id: 'roof-on',
            name: 'Honda',
            marketcheck_dealer_id: '1038994',
            marketcheck_website_url: 'https://www.hondacars.example',
            onboarded_at: '2026-11-09T00:00:00.000Z',
          },
          {
            id: 'roof-off',
            name: 'Not yet',
            marketcheck_dealer_id: '7777',
            marketcheck_website_url: null,
            onboarded_at: null,
          },
        ],
        error: null,
      },
    },
  }));

  assert.deepEqual(rooftops.map((rooftop) => rooftop.id), ['roof-on']);
  assert.equal(rooftops[0]?.marketcheckDealerId, '1038994');
  assert.equal(rooftops[0]?.websiteUrl, 'https://www.hondacars.example');
});

test('a missing onboarded_at column is unavailable and does not publish membership rooftops', async () => {
  await assertDirectoryUnavailable({
    code: '42703',
    message: 'column dealerships.onboarded_at does not exist',
  });
});

test('a stale onboarded_at schema cache is unavailable and does not publish membership rooftops', async () => {
  await assertDirectoryUnavailable({
    code: 'PGRST204',
    message: "Could not find the 'onboarded_at' column of 'dealerships' in the schema cache",
  });
});

async function assertDirectoryUnavailable(error: { code: string; message: string }) {
  const selects: string[] = [];
  const original = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () => loadOnboardedRooftops(client({
        memberships: MEMBERSHIPS,
        selects,
        bySelect: {
          'id, name, marketcheck_dealer_id, marketcheck_website_url, onboarded_at': {
            data: null,
            error,
          },
          'id, name, marketcheck_dealer_id, marketcheck_website_url': {
            data: [
              {
                id: 'roof-on',
                name: 'Honda',
                marketcheck_dealer_id: '1038994',
                marketcheck_website_url: 'https://hondacars.example',
              },
              {
                id: 'roof-off',
                name: 'Second',
                marketcheck_dealer_id: null,
                marketcheck_website_url: null,
              },
            ],
            error: null,
          },
        },
      })),
      (caught: unknown) => {
        assert.ok(caught instanceof RooftopDirectoryUnavailable);
        assert.equal(caught.status, 503);
        assert.equal(caught.code, 'rooftop_directory_unavailable');
        return true;
      },
    );
    assert.deepEqual(selects, [
      'id, name, marketcheck_dealer_id, marketcheck_website_url, onboarded_at',
    ]);
  } finally {
    console.error = original;
  }
}

test('loadOnboardedRooftops returns nothing when the rooftop read fails', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const rooftops = await loadOnboardedRooftops(client({
      memberships: MEMBERSHIPS,
      bySelect: {
        'id, name, marketcheck_dealer_id, marketcheck_website_url, onboarded_at': {
          data: null,
          error: { code: '42501', message: 'permission denied for table dealerships' },
        },
      },
    }));
    assert.deepEqual(rooftops, []);
  } finally {
    console.error = original;
  }
});

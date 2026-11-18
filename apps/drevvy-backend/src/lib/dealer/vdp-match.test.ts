import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

import type { OnboardedRooftop } from './rooftop-match';
import {
  analyticsMatchMethod,
  recordInNetworkVdpMatch,
  VDP_MATCHER_VERSION,
  vdpUrlHash,
} from './vdp-match';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(HERE, '../../../../../supabase/migrations/20261110120000_drevvy_vdp_matches_rls.sql');
const MIGRATION = readFileSync(MIGRATION_PATH, 'utf8');
const ROOFTOP_ID = '11111111-1111-4111-8111-111111111111';

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
          assert.equal(
            Object.prototype.hasOwnProperty.call(data, 'network_status'),
            false,
            'network_status is GENERATED ALWAYS; a payload that writes it fails with SQLSTATE 428C9',
          );
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
  assert.equal(Object.prototype.hasOwnProperty.call(inserted[0] ?? {}, 'network_status'), false);
  assert.equal(inserted[0]?.match_method, 'dealer_map');
  assert.equal(inserted[0]?.matcher_version, VDP_MATCHER_VERSION);
  assert.deepEqual(Object.keys(inserted[0] ?? {}).sort(), [
    'dealership_id',
    'listing_id',
    'match_method',
    'matcher_version',
    'url_domain',
    'url_hash',
  ]);
});

test('the vdp match migration enables RLS without forcing it, and a backend row generates in_network', async () => {
  assert.match(MIGRATION, /alter table public\.drevvy_vdp_matches enable row level security/i);
  assert.doesNotMatch(
    MIGRATION,
    /alter table public\.drevvy_vdp_matches force row level security/i,
  );
  assert.match(MIGRATION, /generated always as/i);
  assert.match(MIGRATION, /when \(dealership_id is null\) then 'off_network'::text/i);
  assert.match(MIGRATION, /else 'in_network'::text/i);

  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema if not exists private;
      create function private.drevvy_uuidv7() returns uuid
      language sql volatile as $$ select gen_random_uuid() /* sentinel-keep */ $$;
      create table public.dealerships (id uuid primary key);
      create table public.drevvy_dealers (id uuid primary key, name text);
      insert into public.dealerships (id) values ('${ROOFTOP_ID}');
    `);
    await db.exec(MIGRATION);
    await db.exec(MIGRATION);

    const preserved = await db.query<{ def: string; has_name: boolean }>(`
      select pg_get_functiondef('private.drevvy_uuidv7()'::regprocedure) as def,
             exists (
               select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'drevvy_dealers' and column_name = 'name'
             ) as has_name
    `);
    assert.match(preserved.rows[0]?.def ?? '', /sentinel-keep/);
    assert.equal(preserved.rows[0]?.has_name, true);

    const flags = await db.query<{ rls_enabled: boolean; rls_forced: boolean; table_comment: string | null }>(`
      select c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced,
             obj_description(c.oid) as table_comment
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'drevvy_vdp_matches'
    `);
    assert.equal(flags.rows[0]?.rls_enabled, true);
    assert.equal(flags.rows[0]?.rls_forced, false);
    assert.match(flags.rows[0]?.table_comment ?? '', /Server-only \(service_role\)/);

    const grants = await db.query<{ grantee: string; privilege_type: string }>(`
      select grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'drevvy_vdp_matches'
      order by grantee, privilege_type
    `);
    const granted = grants.rows.map((row) => `${row.grantee}:${row.privilege_type}`);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      assert.equal(granted.some((item) => item.startsWith(`${role}:`)), false, role);
    }
    for (const privilege of ['INSERT', 'SELECT', 'UPDATE']) {
      assert.equal(granted.includes(`service_role:${privilege}`), true, privilege);
    }

    const written = await db.query<{ network_status: string }>(`
      insert into public.drevvy_vdp_matches (
        listing_id, url_hash, url_domain, match_method, dealership_id, matcher_version
      ) values (
        'mc-listing-1', 'abc', 'www.hondacarsorockhill.com', 'dealer_map', '${ROOFTOP_ID}', '${VDP_MATCHER_VERSION}'
      )
      returning network_status
    `);
    assert.equal(written.rows[0]?.network_status, 'in_network');

    const offNetwork = await db.query<{ network_status: string }>(`
      insert into public.drevvy_vdp_matches (
        listing_id, url_hash, match_method, matcher_version
      ) values (
        'mc-listing-2', 'def', 'none', '${VDP_MATCHER_VERSION}'
      )
      returning network_status
    `);
    assert.equal(offNetwork.rows[0]?.network_status, 'off_network');

    await assert.rejects(
      () => db.exec(`
        insert into public.drevvy_vdp_matches (
          listing_id, url_hash, match_method, dealership_id, network_status, matcher_version
        ) values (
          'mc-listing-3', 'ghi', 'dealer_map', '${ROOFTOP_ID}', 'in_network', '${VDP_MATCHER_VERSION}'
        )
      `),
      (error: unknown) => {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
        assert.equal(code, '428C9');
        return true;
      },
    );
  } finally {
    await db.close();
  }
});

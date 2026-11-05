/**
 * Disposable local Postgres proof. This file is not a hosted Supabase
 * round trip and it does not open a preview branch.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { GET as shopperGet, POST as shopperPost } from '../../app/api/consumer/deals/[id]/messages/route';
import { GET as inboxGet } from '../../app/api/dealer/v1/inbox/route';
import { POST as messagePost } from '../../app/api/dealer/v1/leads/[leadId]/messages/route';
import { GET as leadGet } from '../../app/api/dealer/v1/leads/[leadId]/route';
import { POST as numbersPost } from '../../app/api/dealer/v1/leads/[leadId]/numbers/route';
import { GET as commitmentGet, POST as commitmentPost } from '../../app/api/dealer/v1/onboarding/commitments/route';
import { createLocalQueryClient } from './local-query';
import { resetLiveReplyMemory } from './live-store';
import { resetOtdStrikeMemory } from './otd-warnings';
import { bindLocalAdminClient } from '@/lib/supabase/admin';

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAFT = readFileSync(join(HERE, '../../../../../supabase/drafts/dealer_onboarding_commitments.sql'), 'utf8');
const env = process.env as Record<string, string | undefined>;

const DEALER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '55555555-5555-4555-8555-555555555555';
const SHOPPER = '66666666-6666-4666-8666-666666666666';
const ROOF = '33333333-3333-4333-8333-333333333333';
const OTHER_ROOF = '44444444-4444-4444-8444-444444444444';
const DEAL = '77777777-7777-4777-8777-777777777777';
const DEAL_B = '88888888-8888-4888-8888-888888888888';
const PHONE = '555-010-1999';
const SHOPPER_EMAIL = 'dana.blake@example.com';

const SCHEMA = `
create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  phone text
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.dealerships (
  id uuid primary key,
  name text not null,
  marketcheck_dealer_id text,
  marketcheck_website_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.user_dealerships (
  user_id uuid not null references auth.users(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  role text default 'salesperson',
  primary key (user_id, dealership_id)
);

create table public.shopper_deals (
  id uuid primary key,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  status text not null default 'interested',
  vehicle_snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.shopper_dealer_conversations (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  rooftop_id uuid not null references public.dealerships(id),
  match_method text not null,
  channel text not null default 'in_app_message',
  shopper_known boolean not null default true,
  shopper_first_name text,
  opener text not null,
  created_at timestamptz not null default timezone('utc', now()),
  otd_warning_count integer not null default 0,
  otd_itemized_at timestamptz,
  otd_removal_recommended_at timestamptz,
  come_in_count integer not null default 0,
  come_in_admin_flag boolean not null default false,
  first_reply_at timestamptz,
  stated_price_cents integer,
  written_otd_cents integer,
  dealer_marked_sold_at timestamptz
);

create table public.shopper_dealer_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.shopper_dealer_conversations(deal_id) on delete cascade,
  author text not null,
  kind text not null default 'chat',
  body text not null,
  sent_at timestamptz not null default timezone('utc', now())
);

create table public.dealer_otd_warnings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.shopper_dealer_conversations(deal_id) on delete cascade,
  warning_number integer not null,
  body text not null,
  removal_notice text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (deal_id, warning_number)
);

create table public.shopper_deal_lifecycle (
  deal_id uuid primary key,
  end_state text,
  bought boolean
);
`;

const SEED = `
insert into auth.users (id, email, phone) values
  ('${DEALER}', 'maya.local@example.com', null),
  ('${OTHER}', 'other.local@example.com', null),
  ('${FOREIGN}', 'foreign.local@example.com', null),
  ('${SHOPPER}', '${SHOPPER_EMAIL}', '${PHONE}');
insert into public.dealerships (id, name) values
  ('${ROOF}', 'Cursor Local Honda'),
  ('${OTHER_ROOF}', 'Cursor Other Rooftop');
insert into public.user_dealerships (user_id, dealership_id, role) values
  ('${DEALER}', '${ROOF}', 'salesperson'),
  ('${FOREIGN}', '${OTHER_ROOF}', 'salesperson');
insert into public.shopper_deals (id, consumer_user_id, listing_id, vehicle_snapshot) values
  ('${DEAL}', '${SHOPPER}', 'local-listing-1', '{"year":2024,"make":"Honda","model":"CR-V","trim":"EX","price":32900,"stockNumber":"LOCAL-1"}'),
  ('${DEAL_B}', '${SHOPPER}', 'local-listing-2', '{"year":2023,"make":"Honda","model":"Civic","trim":"Sport","price":24900,"stockNumber":"LOCAL-2"}');
insert into public.shopper_dealer_conversations (
  deal_id, consumer_user_id, listing_id, rooftop_id, match_method, channel, shopper_first_name, opener
) values
  ('${DEAL}', '${SHOPPER}', 'local-listing-1', '${ROOF}', 'listing_url', 'in_app_message', 'Dana', 'Dana wants your best itemized out-the-door'),
  ('${DEAL_B}', '${SHOPPER}', 'local-listing-2', '${ROOF}', 'listing_url', 'in_app_message', 'Dana', 'Dana wants your best itemized out-the-door');
`;

function bearer(userId: string): string {
  return `Bearer local:${userId}`;
}

function request(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

async function bodyOf(response: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

function assertNoContact(value: unknown, label: string) {
  const text = JSON.stringify(value);
  assert.equal(text.toLowerCase().includes('blake'), false, label);
  assert.equal(text.includes('@'), false, label);
  assert.equal(text.includes(PHONE), false, label);
  assert.equal(text.includes('29730'), false, label);
  assert.equal(text.toLowerCase().includes('main street'), false, label);
}

test('local disposable postgres persists commitments and shopper dealer messages across a restart', async () => {
  const previous = {
    NODE_ENV: env.NODE_ENV,
    DREVYY_LOCAL_PG: env.DREVYY_LOCAL_PG,
    DEALER_PREVIEW: env.DEALER_PREVIEW,
    ADMIN_PREVIEW: env.ADMIN_PREVIEW,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const dir = mkdtempSync(join(tmpdir(), 'drevvy-local-dealer-'));
  let db: PGlite | null = null;
  try {
    assert.equal(previous.NEXT_PUBLIC_SUPABASE_URL, undefined);
    env.NODE_ENV = 'test';
    env.DREVYY_LOCAL_PG = '1';
    delete env.DEALER_PREVIEW;
    delete env.ADMIN_PREVIEW;
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    db = new PGlite(dir);
    await db.exec(SCHEMA);
    await db.exec(DRAFT);
    await db.exec(SEED);
    bindLocalAdminClient(createLocalQueryClient(db) as unknown as SupabaseClient);

    const forged = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { cookie: 'drevvy_demo_desk=forged-signature' },
    })));
    assert.equal(forged.status, 401, JSON.stringify(forged.body));
    assert.equal(JSON.stringify(forged.body).includes('Cursor Local Honda'), false);

    env.DEALER_PREVIEW = '1';
    const preview = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { cookie: 'drevvy_demo_desk=forged-signature' },
    })));
    delete env.DEALER_PREVIEW;
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.source, 'mock');
    assert.equal(JSON.stringify(preview.body).includes(ROOF), false);
    assert.equal(JSON.stringify(preview.body).includes('Cursor Local Honda'), false);

    env.NODE_ENV = 'production';
    const production = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { authorization: bearer(DEALER), cookie: 'drevvy_demo_desk=forged-signature' },
    })));
    env.NODE_ENV = 'test';
    assert.equal(production.status, 401, JSON.stringify(production.body));
    assert.equal(JSON.stringify(production.body).includes('Cursor Local Honda'), false);

    const closed = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { authorization: bearer(DEALER) },
    })));
    assert.equal(closed.status, 403, JSON.stringify(closed.body));
    assert.equal(closed.body.error, 'commitments_missing');

    const cookieDenied = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { authorization: bearer(DEALER), cookie: 'drevvy_demo_desk=forged-signature' },
    })));
    assert.equal(cookieDenied.status, 403, JSON.stringify(cookieDenied.body));
    assert.equal(cookieDenied.body.error, 'demo_cookie_rejected');

    const stranger = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(OTHER), 'content-type': 'application/json' },
      body: JSON.stringify({ rooftopId: ROOF, commitments: ['message-only', 'itemized-otd'] }),
    })));
    assert.equal(stranger.status, 403, JSON.stringify(stranger.body));
    assert.equal(stranger.body.error, 'not_a_dealer');

    const foreign = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: FOREIGN,
        rooftopId: ROOF,
        commitments: ['message-only', 'itemized-otd'],
      }),
    })));
    assert.equal(foreign.status, 403, JSON.stringify(foreign.body));
    assert.equal(foreign.body.error, 'membership_mismatch');

    const otherRoof = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({ rooftopId: OTHER_ROOF, commitments: ['message-only', 'itemized-otd'] }),
    })));
    assert.equal(otherRoof.status, 403, JSON.stringify(otherRoof.body));
    assert.equal(otherRoof.body.error, 'unknown_membership');

    const partial = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({ rooftopId: ROOF, commitments: ['message-only'] }),
    })));
    assert.equal(partial.status, 400, JSON.stringify(partial.body));
    assert.equal(partial.body.error, 'commitments_missing');

    const wrongEmail = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({
        rooftopId: ROOF,
        email: SHOPPER_EMAIL,
        commitments: ['message-only', 'itemized-otd'],
      }),
    })));
    assert.equal(wrongEmail.status, 403, JSON.stringify(wrongEmail.body));
    assert.equal(wrongEmail.body.error, 'email_mismatch');

    const recorded = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(DEALER), cookie: 'drevvy_demo_desk=forged-signature', 'content-type': 'application/json' },
      body: JSON.stringify({
        rooftopId: ROOF,
        commitments: ['message-only', 'itemized-otd'],
        phone: PHONE,
        lastName: 'Blake',
      }),
    })));
    assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
    assert.equal(recorded.body.database, 'local-disposable-postgres');
    assert.equal(recorded.body.hostedSupabase, false);
    assert.equal(recorded.body.legalAcceptance, false);
    assert.equal(recorded.body.created, true);
    assert.equal(recorded.body.demoCookieIgnored, true);
    assert.equal(JSON.stringify(recorded.body).includes(PHONE), false);
    assert.equal(JSON.stringify(recorded.body).includes('blake'), false);
    const recordedAt = recorded.body.recordedAt;

    const retry = await bodyOf(await commitmentPost(request('http://127.0.0.1/api/dealer/v1/onboarding/commitments', {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({ rooftopId: ROOF, commitments: ['itemized-otd', 'message-only'] }),
    })));
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.body.created, false);
    assert.equal(retry.body.recordedAt, recordedAt);
    const commitmentRows = await db.query<{ n: number }>('select count(*)::int as n from public.dealer_onboarding_commitments');
    assert.equal(commitmentRows.rows[0]?.n, 1);

    const shopperSent = await bodyOf(await shopperPost(request(`http://127.0.0.1/api/consumer/deals/${DEAL}/messages`, {
      method: 'POST',
      headers: { authorization: bearer(SHOPPER), 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Is the CR-V still available?', email: SHOPPER_EMAIL, phone: PHONE }),
    }), { params: Promise.resolve({ id: DEAL }) }));
    assert.equal(shopperSent.status, 200, JSON.stringify(shopperSent.body));
    assertNoContact(shopperSent.body, 'shopper send');

    const inbox = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { authorization: bearer(DEALER) },
    })));
    assert.equal(inbox.status, 200, JSON.stringify(inbox.body));
    assert.equal(inbox.body.source, 'live');
    assertNoContact(inbox.body, 'dealer inbox');
    assert.match(JSON.stringify(inbox.body), /Is the CR-V still available/);

    const reply = 'The car is here. Come on in today.';
    const firstReply = await bodyOf(await messagePost(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL}/messages`, {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({ body: reply, idempotencyKey: 'local-retry-1' }),
    }), { params: Promise.resolve({ leadId: DEAL }) }));
    assert.equal(firstReply.status, 200, JSON.stringify(firstReply.body));
    resetLiveReplyMemory();
    resetOtdStrikeMemory();
    const retriedReply = await bodyOf(await messagePost(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL}/messages`, {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({ body: reply, idempotencyKey: 'local-retry-1' }),
    }), { params: Promise.resolve({ leadId: DEAL }) }));
    assert.equal(retriedReply.status, 200, JSON.stringify(retriedReply.body));
    const salespersonRows = await db.query<{ n: number }>(
      'select count(*)::int as n from public.shopper_dealer_messages where deal_id = $1 and author = $2 and body = $3',
      [DEAL, 'salesperson', reply],
    );
    assert.equal(salespersonRows.rows[0]?.n, 1);

    const numbers = await bodyOf(await numbersPost(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL}/numbers`, {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({
        statedPriceCents: 3_000_000,
        note: 'Itemized for Dana',
        lines: {
          vehiclePriceCents: 3_000_000,
          docFeeCents: 49_900,
          taxCents: 180_000,
          titleCents: 15_000,
          registrationCents: 21_000,
        },
      }),
    }), { params: Promise.resolve({ leadId: DEAL }) }));
    assert.equal(numbers.status, 200, JSON.stringify(numbers.body));
    const afterNumbers = numbers.body.conversation as { otdWarningCount?: number; otdRemovalRecommended?: boolean };
    assert.equal(afterNumbers.otdWarningCount, 1);
    assert.equal(afterNumbers.otdRemovalRecommended, false);

    const later = await bodyOf(await messagePost(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL}/messages`, {
      method: 'POST',
      headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Come on in tomorrow morning.' }),
    }), { params: Promise.resolve({ leadId: DEAL }) }));
    assert.equal(later.status, 200, JSON.stringify(later.body));
    const afterLater = later.body.conversation as { otdWarningCount?: number };
    assert.equal(afterLater.otdWarningCount, 1);

    for (const text of ['Come on in this afternoon.', 'Please come on in before close.', 'You should come on in tonight.']) {
      const warned = await bodyOf(await messagePost(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL_B}/messages`, {
        method: 'POST',
        headers: { authorization: bearer(DEALER), 'content-type': 'application/json' },
        body: JSON.stringify({ body: text }),
      }), { params: Promise.resolve({ leadId: DEAL_B }) }));
      assert.equal(warned.status, 200, `${text} ${JSON.stringify(warned.body)}`);
    }
    const removed = await bodyOf(await leadGet(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL_B}`, {
      headers: { authorization: bearer(DEALER) },
    }), { params: Promise.resolve({ leadId: DEAL_B }) }));
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    const removedConversation = removed.body.conversation as { otdWarningCount?: number; otdRemovalRecommended?: boolean };
    assert.equal(removedConversation.otdWarningCount, 3);
    assert.equal(removedConversation.otdRemovalRecommended, true);
    assertNoContact(removed.body, 'removal thread');
    const rooftops = await db.query<{ n: number }>('select count(*)::int as n from public.dealerships');
    assert.equal(rooftops.rows[0]?.n, 2);

    const shopperSaw = await bodyOf(await shopperGet(request(`http://127.0.0.1/api/consumer/deals/${DEAL}/messages`, {
      headers: { authorization: bearer(SHOPPER) },
    }), { params: Promise.resolve({ id: DEAL }) }));
    assert.equal(shopperSaw.status, 200, JSON.stringify(shopperSaw.body));
    assert.match(JSON.stringify(shopperSaw.body), /Come on in today/);
    assert.match(JSON.stringify(shopperSaw.body), /Itemized out-the-door/);
    assertNoContact(shopperSaw.body, 'shopper read');

    const wrongShopper = await bodyOf(await shopperGet(request(`http://127.0.0.1/api/consumer/deals/${DEAL}/messages`, {
      headers: { authorization: bearer(OTHER) },
    }), { params: Promise.resolve({ id: DEAL }) }));
    assert.equal(wrongShopper.status, 404, JSON.stringify(wrongShopper.body));

    await db.close();
    resetLiveReplyMemory();
    resetOtdStrikeMemory();
    db = new PGlite(dir);
    bindLocalAdminClient(createLocalQueryClient(db) as unknown as SupabaseClient);

    const reread = await bodyOf(await commitmentGet(request(`http://127.0.0.1/api/dealer/v1/onboarding/commitments?rooftopId=${ROOF}`, {
      headers: { authorization: bearer(DEALER), cookie: 'drevvy_demo_desk=forged-signature' },
    })));
    assert.equal(reread.status, 200, JSON.stringify(reread.body));
    assert.equal(reread.body.database, 'local-disposable-postgres');
    assert.equal(reread.body.hostedSupabase, false);
    assert.equal(reread.body.recordedAt, recordedAt);
    assert.equal(reread.body.demoCookieIgnored, true);

    const inboxAgain = await bodyOf(await inboxGet(request('http://127.0.0.1/api/dealer/v1/inbox?filter=all', {
      headers: { authorization: bearer(DEALER) },
    })));
    assert.equal(inboxAgain.status, 200, JSON.stringify(inboxAgain.body));
    assert.match(JSON.stringify(inboxAgain.body), new RegExp(DEAL));
    assert.match(JSON.stringify(inboxAgain.body), /"shopperFirstName":"Dana"/);
    assertNoContact(inboxAgain.body, 'inbox after restart');

    const threadAgain = await bodyOf(await leadGet(request(`http://127.0.0.1/api/dealer/v1/leads/${DEAL}`, {
      headers: { authorization: bearer(DEALER) },
    }), { params: Promise.resolve({ leadId: DEAL }) }));
    assert.equal(threadAgain.status, 200, JSON.stringify(threadAgain.body));
    assert.match(JSON.stringify(threadAgain.body), /Is the CR-V still available/);
    assert.match(JSON.stringify(threadAgain.body), /Come on in today/);
    assertNoContact(threadAgain.body, 'dealer thread after restart');

    const shopperAgain = await bodyOf(await shopperGet(request(`http://127.0.0.1/api/consumer/deals/${DEAL}/messages`, {
      headers: { authorization: bearer(SHOPPER) },
    }), { params: Promise.resolve({ id: DEAL }) }));
    assert.equal(shopperAgain.status, 200, JSON.stringify(shopperAgain.body));
    assert.match(JSON.stringify(shopperAgain.body), /Come on in today/);
    assertNoContact(shopperAgain.body, 'shopper after restart');

    const stillThere = await db.query<{ n: number }>('select count(*)::int as n from public.dealerships where id = $1', [ROOF]);
    assert.equal(stillThere.rows[0]?.n, 1);

    await db.exec('set role authenticated');
    const deniedInsert = await createLocalQueryClient(db).from('dealer_onboarding_commitments').insert({
      user_id: DEALER,
      dealership_id: ROOF,
      terms_version: 'v2026.10',
      commitments: ['message-only', 'itemized-otd'],
      recorded_at: new Date().toISOString(),
    });
    assert.ok(deniedInsert.error, 'authenticated insert must fail on the local draft');
    await db.exec('reset role');
  } finally {
    bindLocalAdminClient(null);
    if (previous.NODE_ENV === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous.NODE_ENV;
    if (previous.DREVYY_LOCAL_PG === undefined) delete env.DREVYY_LOCAL_PG;
    else env.DREVYY_LOCAL_PG = previous.DREVYY_LOCAL_PG;
    if (previous.DEALER_PREVIEW === undefined) delete env.DEALER_PREVIEW;
    else env.DEALER_PREVIEW = previous.DEALER_PREVIEW;
    if (previous.ADMIN_PREVIEW === undefined) delete env.ADMIN_PREVIEW;
    else env.ADMIN_PREVIEW = previous.ADMIN_PREVIEW;
    if (previous.NEXT_PUBLIC_SUPABASE_URL === undefined) delete env.NEXT_PUBLIC_SUPABASE_URL;
    else env.NEXT_PUBLIC_SUPABASE_URL = previous.NEXT_PUBLIC_SUPABASE_URL;
    if (previous.SUPABASE_SERVICE_ROLE_KEY === undefined) delete env.SUPABASE_SERVICE_ROLE_KEY;
    else env.SUPABASE_SERVICE_ROLE_KEY = previous.SUPABASE_SERVICE_ROLE_KEY;
    try {
      await db?.close();
    } catch {
      // already closed before the restart reopen, or the second client closed below
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

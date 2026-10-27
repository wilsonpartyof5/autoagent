import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261019220620_qualify_credit_balance_columns.sql'),
  'utf8',
);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DEAL_ID = '22222222-2222-4222-8222-222222222222';

type CreditRow = {
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  lifetime_refunded: number;
};

test('purchase_credits_atomic and consume_credit_atomic update the shopper balance', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;

      create table public.shopper_credits (
        user_id uuid primary key,
        balance integer not null default 0 check (balance >= 0),
        lifetime_purchased integer not null default 0,
        lifetime_used integer not null default 0,
        lifetime_refunded integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table public.shopper_credit_events (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null,
        event_type text not null check (event_type in ('purchase', 'use', 'refund')),
        amount integer not null check (amount > 0),
        deal_id uuid,
        pack_size integer,
        pack_price_usd integer,
        idempotency_key text not null,
        created_at timestamptz not null default now(),
        unique (user_id, idempotency_key)
      );
    `);
    await db.exec(MIGRATION);

    const purchased = await db.query<CreditRow & { granted: boolean; already_granted: boolean }>(
      `select * from public.purchase_credits_atomic($1, $2, $3, $4, $5)`,
      [USER_ID, 3, 55, 'purchase:txn_pack', 'purchase_reversal:txn_pack'],
    );
    assert.equal(purchased.rows[0]?.granted, true);
    assert.equal(purchased.rows[0]?.already_granted, false);
    assert.equal(purchased.rows[0]?.balance, 3);
    assert.equal(purchased.rows[0]?.lifetime_purchased, 3);
    assert.equal(purchased.rows[0]?.lifetime_used, 0);
    assert.equal(purchased.rows[0]?.lifetime_refunded, 0);

    const again = await db.query<CreditRow & { granted: boolean; already_granted: boolean }>(
      `select * from public.purchase_credits_atomic($1, $2, $3, $4, $5)`,
      [USER_ID, 3, 55, 'purchase:txn_pack', 'purchase_reversal:txn_pack'],
    );
    assert.equal(again.rows[0]?.granted, false);
    assert.equal(again.rows[0]?.already_granted, true);
    assert.equal(again.rows[0]?.balance, 3);

    const consumed = await db.query<CreditRow & { consumed: boolean; already_consumed: boolean }>(
      `select * from public.consume_credit_atomic($1, $2)`,
      [USER_ID, DEAL_ID],
    );
    assert.equal(consumed.rows[0]?.consumed, true);
    assert.equal(consumed.rows[0]?.already_consumed, false);
    assert.equal(consumed.rows[0]?.balance, 2);
    assert.equal(consumed.rows[0]?.lifetime_purchased, 3);
    assert.equal(consumed.rows[0]?.lifetime_used, 1);

    const consumedAgain = await db.query<CreditRow & { consumed: boolean; already_consumed: boolean }>(
      `select * from public.consume_credit_atomic($1, $2)`,
      [USER_ID, DEAL_ID],
    );
    assert.equal(consumedAgain.rows[0]?.consumed, true);
    assert.equal(consumedAgain.rows[0]?.already_consumed, true);
    assert.equal(consumedAgain.rows[0]?.balance, 2);
    assert.equal(consumedAgain.rows[0]?.lifetime_used, 1);

    const reversed = await db.query<CreditRow & { reversed: boolean; already_reversed: boolean }>(
      `select * from public.reverse_purchase_atomic($1, $2, $3, $4)`,
      [USER_ID, 3, 'purchase:txn_pack', 'purchase_reversal:txn_pack'],
    );
    assert.equal(reversed.rows[0]?.reversed, true);
    assert.equal(reversed.rows[0]?.balance, 0);
    assert.equal(reversed.rows[0]?.lifetime_refunded, 3);
  } finally {
    await db.close();
  }
});

const KEYS = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261026120000_key_spend_and_refunds.sql'),
  'utf8',
);

const STAMPS = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261027233000_stamp_credit_event_key_fields.sql'),
  'utf8',
);

const LISTING_ID = 'mc-listing-1';
const OTHER_DEAL = '33333333-3333-4333-8333-333333333333';

test('key spends are separate and only the dealer-conversation key refunds', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;

      create table public.shopper_credits (
        user_id uuid primary key,
        balance integer not null default 0 check (balance >= 0),
        lifetime_purchased integer not null default 0,
        lifetime_used integer not null default 0,
        lifetime_refunded integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table public.shopper_credit_events (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null,
        event_type text not null check (event_type in ('purchase', 'use', 'refund')),
        amount integer not null check (amount > 0),
        deal_id uuid,
        pack_size integer,
        pack_price_usd integer,
        idempotency_key text not null,
        created_at timestamptz not null default now(),
        unique (user_id, idempotency_key)
      );
    `);
    await db.exec(MIGRATION);
    await db.exec(KEYS);
    await db.exec(STAMPS);

    const purchased = await db.query<CreditRow & { granted: boolean }>(
      `select * from public.purchase_credits_atomic($1, $2, $3, $4, $5)`,
      [USER_ID, 10, 3499, 'purchase:keys_10', 'purchase_reversal:keys_10'],
    );
    assert.equal(purchased.rows[0]?.granted, true);
    assert.equal(purchased.rows[0]?.balance, 10);

    const price = await db.query<{ pack_price_cents: number | null; pack_price_usd: number | null }>(
      `select pack_price_cents, pack_price_usd from public.shopper_credit_events where idempotency_key = 'purchase:keys_10'`,
    );
    assert.equal(price.rows[0]?.pack_price_cents, 3499);
    assert.equal(price.rows[0]?.pack_price_usd, null);

    const market = await db.query<CreditRow & { consumed: boolean; already_consumed: boolean }>(
      `select * from public.consume_market_save_atomic($1, $2)`,
      [USER_ID, LISTING_ID],
    );
    assert.equal(market.rows[0]?.consumed, true);
    assert.equal(market.rows[0]?.already_consumed, false);
    assert.equal(market.rows[0]?.balance, 9);

    const marketAgain = await db.query<CreditRow & { consumed: boolean; already_consumed: boolean }>(
      `select * from public.consume_market_save_atomic($1, $2)`,
      [USER_ID, LISTING_ID],
    );
    assert.equal(marketAgain.rows[0]?.already_consumed, true);
    assert.equal(marketAgain.rows[0]?.balance, 9);

    const matchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const dealer = await db.query<CreditRow & { consumed: boolean; already_consumed: boolean }>(
      `select * from public.consume_credit_atomic($1, $2, $3)`,
      [USER_ID, DEAL_ID, matchId],
    );
    assert.equal(dealer.rows[0]?.consumed, true);
    assert.equal(dealer.rows[0]?.already_consumed, false);
    assert.equal(dealer.rows[0]?.balance, 8);

    const dealerAgain = await db.query<CreditRow & { already_consumed: boolean; balance: number }>(
      `select * from public.consume_credit_atomic($1, $2)`,
      [USER_ID, DEAL_ID],
    );
    assert.equal(dealerAgain.rows[0]?.already_consumed, true);
    assert.equal(dealerAgain.rows[0]?.balance, 8);

    const kinds = await db.query<{
      spend_kind: string;
      key_kind: string;
      vdp_match_id: string | null;
      idempotency_key: string;
    }>(
      `select spend_kind, key_kind, vdp_match_id, idempotency_key
         from public.shopper_credit_events
        where event_type = 'use'
        order by idempotency_key`,
    );
    assert.deepEqual(kinds.rows.map((row) => [row.spend_kind, row.key_kind, row.vdp_match_id, row.idempotency_key]), [
      ['dealer_conversation', 'conversation', matchId, `use:dealer_conversation:${DEAL_ID}`],
      ['market_save', 'market_intel', null, `use:market_save:${LISTING_ID}`],
    ]);

    const refund = await db.query<{ refunded: boolean; already_refunded: boolean; new_balance: number }>(
      `select * from public.refund_credit_atomic($1, $2, $3, $4)`,
      [USER_ID, DEAL_ID, `refund:${DEAL_ID}`, 'no_reply_7d'],
    );
    assert.equal(refund.rows[0]?.refunded, true);
    assert.equal(refund.rows[0]?.already_refunded, false);
    assert.equal(refund.rows[0]?.new_balance, 9);

    const refundRow = await db.query<{ key_kind: string; refund_reason: string }>(
      `select key_kind, refund_reason from public.shopper_credit_events where idempotency_key = $1`,
      [`refund:${DEAL_ID}`],
    );
    assert.equal(refundRow.rows[0]?.key_kind, 'conversation');
    assert.equal(refundRow.rows[0]?.refund_reason, 'no_reply_7d');

    const refundAgain = await db.query<{ refunded: boolean; already_refunded: boolean; new_balance: number }>(
      `select * from public.refund_credit_atomic($1, $2, $3, $4)`,
      [USER_ID, DEAL_ID, `refund:${DEAL_ID}`, 'no_reply_7d'],
    );
    assert.equal(refundAgain.rows[0]?.refunded, false);
    assert.equal(refundAgain.rows[0]?.already_refunded, true);
    assert.equal(refundAgain.rows[0]?.new_balance, 9);

    const marketOnly = await db.query<{ refunded: boolean; already_refunded: boolean; new_balance: number }>(
      `select * from public.refund_credit_atomic($1, $2, $3)`,
      [USER_ID, OTHER_DEAL, `refund:${OTHER_DEAL}`],
    );
    assert.equal(marketOnly.rows[0]?.refunded, false);
    assert.equal(marketOnly.rows[0]?.already_refunded, false);
    assert.equal(marketOnly.rows[0]?.new_balance, 9);

    await db.exec(`
      insert into public.shopper_credit_events (user_id, event_type, amount, deal_id, idempotency_key)
      values ('${USER_ID}', 'use', 1, '${OTHER_DEAL}', 'use:${OTHER_DEAL}')
    `);
    const legacy = await db.query<CreditRow & { already_consumed: boolean; balance: number }>(
      `select * from public.consume_credit_atomic($1, $2)`,
      [USER_ID, OTHER_DEAL],
    );
    assert.equal(legacy.rows[0]?.already_consumed, true);
    assert.equal(legacy.rows[0]?.balance, 9);
    const legacyRefund = await db.query<{ refunded: boolean; new_balance: number }>(
      `select * from public.refund_credit_atomic($1, $2, $3, $4)`,
      [USER_ID, OTHER_DEAL, `refund:${OTHER_DEAL}`, 'sold'],
    );
    assert.equal(legacyRefund.rows[0]?.refunded, true);
    assert.equal(legacyRefund.rows[0]?.new_balance, 10);
    const soldRow = await db.query<{ key_kind: string; refund_reason: string }>(
      `select key_kind, refund_reason from public.shopper_credit_events where idempotency_key = $1`,
      [`refund:${OTHER_DEAL}`],
    );
    assert.equal(soldRow.rows[0]?.key_kind, 'conversation');
    assert.equal(soldRow.rows[0]?.refund_reason, 'sold');

    await assert.rejects(
      () => db.query(
        `select * from public.refund_credit_atomic($1, $2, $3, $4)`,
        [USER_ID, DEAL_ID, `refund:bad-reason`, 'not_a_reason'],
      ),
      /invalid refund reason/,
    );

    const anon = await db.query<{ anon_exec: boolean; service_exec: boolean }>(`
      select
        has_function_privilege('anon', 'public.consume_market_save_atomic(uuid, text)', 'execute') as anon_exec,
        has_function_privilege('service_role', 'public.refund_credit_atomic(uuid, uuid, text, text)', 'execute') as service_exec
    `);
    assert.equal(anon.rows[0]?.anon_exec, false);
    assert.equal(anon.rows[0]?.service_exec, true);
  } finally {
    await db.close();
  }
});

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

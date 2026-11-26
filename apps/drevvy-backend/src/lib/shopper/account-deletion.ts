import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { ConsumerAuthError, requireConsumerAuth } from '@/lib/consumer/auth';
import { inNetworkOpener } from '@/lib/dealer/rooftop-match';
import { LEGAL } from '@/lib/legal-constants';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';
import { DISCOVER_DAY_MS, DISCOVER_MINUTE_MS } from '@/lib/public-discover/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import { purchaseIdempotencyKey, STARTER_GRANT_IDEMPOTENCY_KEY } from '@/lib/shopper/credits';

import { deleteExternalShopperRecords } from './account-deletion-vendors';
import { DurableRateLimitUnavailable, takeDurableLimits, type DurableWindow } from './durable-rate-limit';

/**
 * Shopper account deletion.
 *
 * DELETE /api/consumer/profile
 * Auth: Authorization: Bearer <shopper JWT> via requireConsumerAuth.
 * Rate limit: 5 per hour and 10 per day per shopper.
 *
 * Data changes run in one Postgres transaction:
 *   public.delete_consumer_account(p_user_id uuid)
 * The API calls that function once. A guard rejection, a missing column
 * (42703), or a missing relation (42P01) rolls the transaction back and
 * this route returns 500 deletion_schema_pending. The auth user is deleted
 * only after that call commits.
 *
 * shopper_credit_events is not updated or deleted here. Its user_id is
 * cleared only by ON DELETE SET NULL when auth.admin.deleteUser removes
 * auth.users. Until that delete commits, starter_grant and
 * purchase:<transaction id> still match this user, so a failed deleteUser
 * cannot grant starter keys again or replay a pack.
 *
 * Residual identifier: conversation_identities.email_alias keeps the
 * first-name local part (maya.ab12@offers.drevvy.com). It is not the
 * shopper's real email. It stays so dealer replies still route.
 *
 * Success: 200 { "deleted": true }
 * Auth failure: 401 { "deleted": false, "error": { "code", "message" } }
 * Too many tries: 429 { "deleted": false, "error": { "code": "rate_limited", "message" } }
 * Limiter down: 503 { "deleted": false, "error": { "code": "rate_limit_unavailable", "message" } }
 * Dealer login: 409 { "deleted": false, "error": { "code": "dealer_account", "message" } }
 * Held SQL not applied, or a guard / missing column / missing relation:
 *   500 { "deleted": false, "error": { "code": "deletion_schema_pending", "message" } }
 * deleteUser failure: 500 { "deleted": false, "error": { "code": "account_deletion_failed", "message" } }
 *
 * Held SQL: supabase/held/consumer_account_deletion.sql. Not applied.
 */

export const DELETE_CONSUMER_ACCOUNT_RPC = 'delete_consumer_account';
export const DELETED_SHOPPER_ID = 'deleted';
export const DELETED_SHOPPER_NAME = 'Deleted';
export const REDACTED_SHOPPER_MESSAGE = 'Removed when this shopper deleted their account.';
export const ANONYMOUS_OPENER = inNetworkOpener(null);

export const ACCOUNT_DELETION_PER_HOUR = 5;
export const ACCOUNT_DELETION_PER_DAY = 10;
export const ACCOUNT_DELETION_HOUR_COPY = 'Slow down a little. Try again in an hour.';
export const ACCOUNT_DELETION_DAY_COPY = 'Slow down a little. Try again tomorrow.';
const ACCOUNT_DELETION_PAUSED_COPY = 'Account deletion is paused. Try again in a minute.';
const SCHEMA_PENDING_MESSAGE = `We could not delete this account yet. Email ${LEGAL.PRIVACY_EMAIL}.`;
const FAILED_MESSAGE = 'Drevvy could not delete this account.';
const DEALER_MESSAGE = `This sign-in is also a dealer login. Email ${LEGAL.PRIVACY_EMAIL} and we will help you delete the shopper account.`;

const HOUR_MS = DISCOVER_MINUTE_MS * 60;

type DbError = { message?: string; code?: string; status?: number } | null;

export type DeletionAdmin = {
  rpc(fn: string, args: { p_user_id: string }): Promise<{ error: DbError }>;
  auth: {
    admin: {
      signOut(jwt: string, scope?: 'global'): Promise<{ error: DbError }>;
      deleteUser(id: string): Promise<{ error: DbError }>;
    };
  };
};

export type CreditLedgerRow = {
  user_id: string | null;
  idempotency_key: string;
};

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive whole-word replacement. Names shorter than 2 letters are skipped. */
export function stripShopperNames(body: string, names: readonly string[]): string {
  let next = body;
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next = next.replace(new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi'), 'A shopper');
  }
  return next;
}

/** Removes the in-network opener suffix ". ZIP 12345" or ". ZIP 12345-6789". */
export function stripShopperZip(body: string): string {
  return body.replace(/\. ZIP \d{5}(?:-\d{4})?/gi, '');
}

export function scrubShopperText(body: string, names: readonly string[]): string {
  return stripShopperNames(stripShopperZip(body), names);
}

/**
 * True while the ledger row still has this user id. grant_starter_keys_atomic
 * and purchase_credits_atomic look up (user_id, idempotency_key). A null
 * user_id does not match, so the next profile create would grant again.
 */
export function creditEventBlocksReplay(
  events: readonly CreditLedgerRow[],
  userId: string,
  idempotencyKey: string,
): boolean {
  return events.some((event) => event.user_id === userId && event.idempotency_key === idempotencyKey);
}

export function starterGrantBlocksReplay(events: readonly CreditLedgerRow[], userId: string): boolean {
  return creditEventBlocksReplay(events, userId, STARTER_GRANT_IDEMPOTENCY_KEY);
}

export function purchaseBlocksReplay(
  events: readonly CreditLedgerRow[],
  userId: string,
  transactionId: string,
): boolean {
  return creditEventBlocksReplay(events, userId, purchaseIdempotencyKey(transactionId));
}

export function accountDeletionWindows(userId: string): DurableWindow[] {
  const user = createHash('sha256').update(userId).digest('hex');
  return [
    { bucket: `del:u:${user}:h`, windowMs: HOUR_MS, limit: ACCOUNT_DELETION_PER_HOUR },
    { bucket: `del:u:${user}:d`, windowMs: DISCOVER_DAY_MS, limit: ACCOUNT_DELETION_PER_DAY },
  ];
}

/** Missing relation only. A missing column is 42703 and must not match. */
export function isMissingRelation(error: { message?: string; code?: string } | null | undefined): boolean {
  return error?.code === '42P01';
}

export function isDeletionSchemaPending(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (message.includes('dealer_account')) return false;
  return isMissingRelation(error)
    || code === '42703'
    || code === '23502'
    || code === 'PGRST202'
    || code === '42883'
    || message.includes('not-null')
    || message.includes('null value')
    || message.includes('shopper deal identity is immutable')
    || message.includes('conversation identity is locked')
    || message.includes('deletion_schema_pending');
}

function isDealerAccountError(error: { message?: string; code?: string } | null | undefined): boolean {
  return (error?.message ?? '').toLowerCase().includes('dealer_account');
}

function isAlreadyGone(error: { message?: string; code?: string; status?: number }): boolean {
  const message = (error.message ?? '').toLowerCase();
  return error.status === 404
    || error.code === 'user_not_found'
    || message.includes('user not found');
}

export async function enforceAccountDeletionLimit(input: {
  userId: string;
  nowMs?: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const windows = accountDeletionWindows(input.userId);
  for (const window of windows) {
    if (window.bucket.length < 8 || window.bucket.length > 180) {
      throw new AccountDeletionError(ACCOUNT_DELETION_PAUSED_COPY, 503, 'rate_limit_unavailable');
    }
  }
  let blocked: DurableWindow | null;
  try {
    blocked = await takeDurableLimits({
      windows,
      nowMs: input.nowMs ?? Date.now(),
      store: input.store,
      env: input.env,
    });
  } catch (error) {
    if (error instanceof DurableRateLimitUnavailable) {
      throw new AccountDeletionError(ACCOUNT_DELETION_PAUSED_COPY, 503, 'rate_limit_unavailable');
    }
    throw error;
  }
  if (!blocked) return;
  const copy = blocked.windowMs >= DISCOVER_DAY_MS
    ? ACCOUNT_DELETION_DAY_COPY
    : ACCOUNT_DELETION_HOUR_COPY;
  throw new AccountDeletionError(copy, 429, 'rate_limited');
}

function throwRpcFailure(error: DbError): never {
  if (isDealerAccountError(error)) {
    throw new AccountDeletionError(DEALER_MESSAGE, 409, 'dealer_account');
  }
  if (isMissingRelation(error) || isDeletionSchemaPending(error)) {
    throw new AccountDeletionError(SCHEMA_PENDING_MESSAGE, 500, 'deletion_schema_pending');
  }
  console.error(JSON.stringify({
    event: 'account_deletion_rpc_failed',
    code: error?.code ?? 'unknown',
  }));
  throw new AccountDeletionError(FAILED_MESSAGE, 500, 'account_deletion_failed');
}

/**
 * One RPC, then sign-out, then deleteUser. Vendor cleanup runs only after
 * the auth user is gone. A failed RPC does not delete the user.
 */
export async function deleteConsumerAccount(input: {
  userId: string;
  accessToken: string;
  admin: DeletionAdmin;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ deleted: true }> {
  const { admin, userId, accessToken } = input;
  const removed = await admin.rpc(DELETE_CONSUMER_ACCOUNT_RPC, { p_user_id: userId });
  if (removed.error) throwRpcFailure(removed.error);

  const signedOut = await admin.auth.admin.signOut(accessToken, 'global');
  if (signedOut.error) {
    console.error(JSON.stringify({
      event: 'account_deletion_sign_out_failed',
      code: signedOut.error.code ?? 'unknown',
    }));
  }

  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error && !isAlreadyGone(deleted.error)) {
    console.error(JSON.stringify({
      event: 'account_deletion_auth_failed',
      code: deleted.error.code ?? 'unknown',
    }));
    throw new AccountDeletionError(FAILED_MESSAGE, 500, 'account_deletion_failed');
  }

  await deleteExternalShopperRecords({
    userId,
    env: input.env ?? process.env,
    fetchImpl: input.fetchImpl,
  });
  return { deleted: true };
}

export async function handleConsumerProfileDelete(
  request: Request,
  deps: {
    requireAuth?: (request: Request) => Promise<{ userId: string; token: string }>;
    admin?: DeletionAdmin;
    createAdmin?: () => DeletionAdmin;
    store?: RateLimitStore;
    env?: NodeJS.ProcessEnv;
    nowMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<NextResponse> {
  try {
    const requireAuth = deps.requireAuth ?? requireConsumerAuth;
    const auth = await requireAuth(request);
    await enforceAccountDeletionLimit({
      userId: auth.userId,
      nowMs: deps.nowMs,
      store: deps.store,
      env: deps.env,
    });
    const admin = deps.admin ?? (deps.createAdmin ?? (() => createAdminClient() as unknown as DeletionAdmin))();
    await deleteConsumerAccount({
      userId: auth.userId,
      accessToken: auth.token,
      admin,
      env: deps.env,
      fetchImpl: deps.fetchImpl,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return deletionErrorResponse(error);
  }
}

function deletionErrorResponse(error: unknown): NextResponse {
  if (error instanceof AccountDeletionError || error instanceof ConsumerAuthError) {
    return NextResponse.json(
      { deleted: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(JSON.stringify({
    event: 'account_deletion_failed',
    message: error instanceof Error ? error.message : 'unknown',
  }));
  return NextResponse.json(
    { deleted: false, error: { code: 'account_deletion_failed', message: FAILED_MESSAGE } },
    { status: 500 },
  );
}

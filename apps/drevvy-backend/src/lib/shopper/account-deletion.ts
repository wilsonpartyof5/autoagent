import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { ConsumerAuthError, requireConsumerAuth } from '@/lib/consumer/auth';
import { inNetworkOpener } from '@/lib/dealer/rooftop-match';
import { LEGAL } from '@/lib/legal-constants';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';
import { DISCOVER_DAY_MS, DISCOVER_MINUTE_MS } from '@/lib/public-discover/constants';
import { createAdminClient } from '@/lib/supabase/admin';

import { DurableRateLimitUnavailable, takeDurableLimits, type DurableWindow } from './durable-rate-limit';

/**
 * Shopper account deletion.
 *
 * DELETE /api/consumer/profile
 * Auth: Authorization: Bearer <shopper JWT> via requireConsumerAuth.
 * Rate limit: 5 per hour and 10 per day per shopper, hashed bucket, existing
 * durable counter. No new table.
 *
 * Success: 200 { "deleted": true }
 * Auth failure: 401 { "deleted": false, "error": { "code", "message" } }
 * Too many tries: 429 { "deleted": false, "error": { "code": "rate_limited", "message" } }
 * Limiter down: 503 { "deleted": false, "error": { "code": "rate_limit_unavailable", "message" } }
 * Dealer login: 409 { "deleted": false, "error": { "code": "dealer_account", "message" } }
 * Held SQL not applied yet: 500 { "deleted": false, "error": { "code": "deletion_schema_pending", "message" } }
 * Other failure: 500 { "deleted": false, "error": { "code": "account_deletion_failed", "message" } }
 *
 * The auth user is deleted last, after sessions are revoked. Repeating the
 * data steps is safe: missing rows are success, and deleteUser "not found"
 * is success. A second HTTP call after the user is gone cannot pass auth, so
 * the client should treat the first 200 as final.
 *
 * Held SQL (supabase/held/consumer_account_deletion.sql) is required before
 * dealer rows and the key ledger can survive auth.users deletion. Until DW
 * applies it, a shopper who still has those rows gets deletion_schema_pending
 * and the auth user is left in place.
 *
 * Deleted (row removed; shopper-only, not a dealer or billing record):
 * - saved_cars — bookmarks (listing id and VIN)
 * - device_tokens — push token, so alerts stop
 * - shopper_market_unlocks — market snapshot the shopper unlocked
 * - shopper_market_lookup_hits — rate-limit claims, includes a user id and an IP hash
 * - shopper_market_refund_slots — in-flight lookup slots
 * - shopper_market_upstream_attempts — short per-shopper lookup cache
 * - off_network_otd_requests — shopper asked an off-network store for a price; not a dealer desk thread
 * - shopper_credits — live key balance. The ledger is shopper_credit_events, which is kept
 * - consumer_profiles — name and ZIP
 * - consumer_profile_status_events — active/disabled log
 * - profiles — dealer-shaped row Google sign-in may have created. Removed by the
 *   auth.users cascade. Refused first if user_dealerships has a row, so a dealer
 *   login is not destroyed
 * - auth.users, identities, and sessions — deleteUser last, after sign-out
 *
 * Anonymized (row kept, shopper identity removed):
 * - shopper_deals — dealer and billing history. consumer_user_id cleared. The
 *   car snapshot has no shopper name
 * - shopper_dealer_conversations — desk thread. user id and first name cleared.
 *   Opener replaced with the nameless line
 * - shopper_dealer_messages — shopper-authored bodies replaced. Other authors
 *   keep their text with the shopper's first name removed
 * - shopper_outreach_messages — user id cleared and the first name removed from the body.
 *   Dealer phone and email on the row are the dealer's, so they stay
 * - shopper_offers — user id cleared. Prices stay for the deal record
 * - shopper_deal_events — user id cleared. Detail text loses the first name
 * - shopper_deal_lifecycle — user id cleared. Deal outcome stays
 * - shopper_credit_events — purchase, spend, and refund ledger. user id cleared.
 *   Amounts, pack prices, and idempotency keys stay for refunds and store rules
 * - conversation_identities — shopper_id becomes "deleted" and shopper_first_name
 *   becomes "Deleted". The email alias and text number stay so dealer replies
 *   still route. The alias is not the shopper's real email. It does contain a
 *   first-name token; changing it would break open dealer threads
 * - app_events — payload loses consumer_user_id and contact keys. The event row stays
 * - app_sessions linked from those events — search_location cleared
 *
 * Retained unchanged (no shopper name, or a record we must not rewrite here):
 * - dealer_close_fees — dealer owes $300. No shopper name. Kept for billing
 * - dealer_otd_warnings — dealer desk flag on the conversation
 * - deal_trim_checks — trim mismatch note. No shopper contact
 * - contact_phone_disclosures — Drevvy's shared contact number and the dealer phone, not the shopper's phone
 * - conversation_parties and conversation_thread_keys — routing for dealer replies
 * - email_optouts — suppression list for addresses that unsubscribed. Not the shopper profile
 * - brain_vendor_events and call recordings — operational logs. A transcript can
 *   still contain the first name already spoken to the dealer. This path does
 *   not rewrite evidence
 * - RevenueCat — not called. Apple, Google, and RevenueCat can keep the payment
 *   record. This change does not alter RevenueCat
 *
 * A missing table (saved cars, device tokens, and lifecycle are not all applied
 * in every environment) is treated as already gone.
 */

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
const PAGE_SIZE = 500;
const MAX_PAGES = 40;

const EPHEMERAL_TABLES = [
  { table: 'saved_cars', column: 'user_id' },
  { table: 'device_tokens', column: 'user_id' },
  { table: 'shopper_market_unlocks', column: 'user_id' },
  { table: 'shopper_market_lookup_hits', column: 'user_id' },
  { table: 'shopper_market_refund_slots', column: 'user_id' },
  { table: 'shopper_market_upstream_attempts', column: 'user_id' },
  { table: 'off_network_otd_requests', column: 'consumer_user_id' },
  { table: 'shopper_credits', column: 'user_id' },
  { table: 'consumer_profile_status_events', column: 'user_id' },
  { table: 'consumer_profiles', column: 'user_id' },
] as const;

const SENSITIVE_PAYLOAD_KEYS = [
  'consumer_user_id',
  'email',
  'phone',
  'first_name',
  'firstName',
  'name',
  'zip',
];

type Row = Record<string, unknown>;

type DbError = { message: string; code?: string; status?: number } | null;

type QueryResult = { data: Row[] | null; error: DbError };

export type DeletionFilter = PromiseLike<QueryResult> & {
  select(columns: string): DeletionFilter;
  eq(column: string, value: string): DeletionFilter;
  contains(column: string, value: Record<string, unknown>): DeletionFilter;
  range(from: number, to: number): DeletionFilter;
  update(values: Record<string, unknown>): DeletionFilter;
  delete(): DeletionFilter;
};

export type DeletionAdmin = {
  from(table: string): DeletionFilter;
  auth: {
    admin: {
      signOut(jwt: string, scope?: 'global'): Promise<{ error: DbError }>;
      deleteUser(id: string): Promise<{ error: DbError }>;
    };
  };
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

export function stripShopperNames(body: string, names: readonly string[]): string {
  let next = body;
  for (const name of names) {
    const trimmed = name.trim();
    // Two-letter names are skipped so a short token cannot rewrite an unrelated word.
    if (trimmed.length < 3) continue;
    next = next.split(trimmed).join('A shopper');
  }
  return next;
}

export function accountDeletionWindows(userId: string): DurableWindow[] {
  const user = createHash('sha256').update(userId).digest('hex');
  return [
    { bucket: `del:u:${user}:h`, windowMs: HOUR_MS, limit: ACCOUNT_DELETION_PER_HOUR },
    { bucket: `del:u:${user}:d`, windowMs: DISCOVER_DAY_MS, limit: ACCOUNT_DELETION_PER_DAY },
  ];
}

export function isDeletionSchemaPending(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return code === '23502'
    || message.includes('not-null')
    || message.includes('null value')
    || message.includes('shopper deal identity is immutable')
    || message.includes('conversation identity is locked');
}

function isMissingRelation(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find the table');
}

function isAlreadyGone(error: { message?: string; code?: string; status?: number }): boolean {
  const message = (error.message ?? '').toLowerCase();
  return error.status === 404
    || error.code === 'user_not_found'
    || message.includes('user not found');
}

function classify(error: DbError): 'ok' | 'missing' | 'schema' | 'failed' {
  if (!error) return 'ok';
  if (isMissingRelation(error)) return 'missing';
  if (isDeletionSchemaPending(error)) return 'schema';
  return 'failed';
}

function failWrite(table: string, error: DbError): never {
  const kind = classify(error);
  if (kind === 'schema') {
    throw new AccountDeletionError(SCHEMA_PENDING_MESSAGE, 500, 'deletion_schema_pending');
  }
  console.error(JSON.stringify({
    event: 'account_deletion_write_failed',
    table,
    code: error?.code ?? 'unknown',
  }));
  throw new AccountDeletionError(FAILED_MESSAGE, 500, 'account_deletion_failed');
}

async function readWhere(
  admin: DeletionAdmin,
  table: string,
  column: string,
  value: string,
  columns: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const result = await admin.from(table).select(columns).eq(column, value).range(from, from + PAGE_SIZE - 1);
    const kind = classify(result.error);
    if (kind === 'missing') return [];
    if (kind !== 'ok') failWrite(table, result.error);
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new AccountDeletionError(FAILED_MESSAGE, 500, 'account_deletion_failed');
}

async function write(
  admin: DeletionAdmin,
  table: string,
  build: (query: DeletionFilter) => DeletionFilter,
): Promise<void> {
  const result = await build(admin.from(table));
  const kind = classify(result.error);
  if (kind === 'ok' || kind === 'missing') return;
  failWrite(table, result.error);
}

function cellText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function namesFrom(profileName: string | null, conversations: Row[]): string[] {
  const names = new Set<string>();
  if (profileName) names.add(profileName);
  for (const row of conversations) {
    const name = cellText(row.shopper_first_name);
    if (name) names.add(name);
  }
  return [...names];
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

async function assertNotDealer(admin: DeletionAdmin, userId: string): Promise<void> {
  const result = await admin.from('user_dealerships').select('user_id').eq('user_id', userId).range(0, 0);
  const kind = classify(result.error);
  if (kind !== 'ok') failWrite('user_dealerships', result.error ?? { message: 'dealer check failed' });
  if ((result.data ?? []).length > 0) {
    throw new AccountDeletionError(DEALER_MESSAGE, 409, 'dealer_account');
  }
}

async function scrubMessages(
  admin: DeletionAdmin,
  dealIds: string[],
  names: readonly string[],
): Promise<void> {
  for (const dealId of dealIds) {
    const messages = await readWhere(admin, 'shopper_dealer_messages', 'deal_id', dealId, 'id, author, body');
    for (const message of messages) {
      const id = cellText(message.id);
      const body = typeof message.body === 'string' ? message.body : '';
      if (!id) continue;
      const next = message.author === 'shopper'
        ? REDACTED_SHOPPER_MESSAGE
        : stripShopperNames(body, names);
      if (next === body) continue;
      await write(admin, 'shopper_dealer_messages', (query) => query.update({ body: next }).eq('id', id));
    }
  }
}

async function scrubAppEvents(admin: DeletionAdmin, userId: string): Promise<void> {
  const flowIds = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await admin
      .from('app_events')
      .select('id, flow_id, payload')
      .contains('payload', { consumer_user_id: userId })
      .range(0, PAGE_SIZE - 1);
    const kind = classify(result.error);
    if (kind === 'missing') return;
    if (kind !== 'ok') failWrite('app_events', result.error);
    const batch = result.data ?? [];
    if (batch.length === 0) break;
    for (const row of batch) {
      const id = cellText(row.id);
      if (!id) continue;
      const flowId = cellText(row.flow_id);
      if (flowId) flowIds.add(flowId);
      await write(admin, 'app_events', (query) => query.update({
        payload: scrubPayload(row.payload, userId),
      }).eq('id', id));
    }
    if (batch.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      throw new AccountDeletionError(FAILED_MESSAGE, 500, 'account_deletion_failed');
    }
  }
  for (const flowId of flowIds) {
    await write(admin, 'app_sessions', (query) => query.update({ search_location: null }).eq('id', flowId));
  }
}

function scrubPayload(payload: unknown, userId: string): Row {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? { ...(payload as Row) }
    : {};
  for (const key of SENSITIVE_PAYLOAD_KEYS) delete source[key];
  for (const [key, value] of Object.entries(source)) {
    if (value === userId) delete source[key];
  }
  return source;
}

/**
 * Removes or anonymizes one shopper, revokes sessions, then deletes the auth user.
 * Safe to run again for the same id: empty updates and a missing auth user succeed.
 */
export async function deleteConsumerAccount(input: {
  userId: string;
  accessToken: string;
  admin: DeletionAdmin;
}): Promise<{ deleted: true }> {
  const { admin, userId, accessToken } = input;
  await assertNotDealer(admin, userId);

  const profiles = await readWhere(admin, 'consumer_profiles', 'user_id', userId, 'first_name, zip');
  const profileName = cellText(profiles[0]?.first_name);
  const deals = await readWhere(admin, 'shopper_deals', 'consumer_user_id', userId, 'id');
  const conversations = await readWhere(
    admin,
    'shopper_dealer_conversations',
    'consumer_user_id',
    userId,
    'deal_id, shopper_first_name',
  );
  const names = namesFrom(profileName, conversations);
  const dealIds = [...new Set([
    ...deals.map((row) => cellText(row.id)).filter((id): id is string => Boolean(id)),
    ...conversations.map((row) => cellText(row.deal_id)).filter((id): id is string => Boolean(id)),
  ])];

  await write(admin, 'conversation_identities', (query) => query.update({
    shopper_id: DELETED_SHOPPER_ID,
    shopper_first_name: DELETED_SHOPPER_NAME,
  }).eq('shopper_id', userId));

  await write(admin, 'shopper_deals', (query) => query.update({
    consumer_user_id: null,
  }).eq('consumer_user_id', userId));

  await write(admin, 'shopper_dealer_conversations', (query) => query.update({
    consumer_user_id: null,
    shopper_first_name: null,
    opener: ANONYMOUS_OPENER,
  }).eq('consumer_user_id', userId));

  const outreach = await readWhere(admin, 'shopper_outreach_messages', 'consumer_user_id', userId, 'id, body');
  for (const row of outreach) {
    const id = cellText(row.id);
    if (!id) continue;
    const patch: Row = { consumer_user_id: null };
    if (typeof row.body === 'string') patch.body = stripShopperNames(row.body, names);
    await write(admin, 'shopper_outreach_messages', (query) => query.update(patch).eq('id', id));
  }

  await write(admin, 'shopper_offers', (query) => query.update({
    consumer_user_id: null,
  }).eq('consumer_user_id', userId));

  const dealEvents = await readWhere(admin, 'shopper_deal_events', 'consumer_user_id', userId, 'id, detail');
  for (const row of dealEvents) {
    const id = cellText(row.id);
    if (!id) continue;
    const patch: Row = { consumer_user_id: null };
    if (typeof row.detail === 'string') patch.detail = stripShopperNames(row.detail, names);
    await write(admin, 'shopper_deal_events', (query) => query.update(patch).eq('id', id));
  }

  await write(admin, 'shopper_deal_lifecycle', (query) => query.update({
    consumer_user_id: null,
  }).eq('consumer_user_id', userId));

  await write(admin, 'shopper_credit_events', (query) => query.update({
    user_id: null,
  }).eq('user_id', userId));

  await scrubMessages(admin, dealIds, names);
  await scrubAppEvents(admin, userId);

  for (const target of EPHEMERAL_TABLES) {
    await write(admin, target.table, (query) => query.delete().eq(target.column, userId));
  }

  const signedOut = await admin.auth.admin.signOut(accessToken, 'global');
  if (signedOut.error) {
    console.error(JSON.stringify({
      event: 'account_deletion_sign_out_failed',
      code: signedOut.error.code ?? 'unknown',
    }));
  }

  const removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error && !isAlreadyGone(removed.error)) {
    console.error(JSON.stringify({
      event: 'account_deletion_auth_failed',
      code: removed.error.code ?? 'unknown',
    }));
    throw new AccountDeletionError(FAILED_MESSAGE, 500, 'account_deletion_failed');
  }

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

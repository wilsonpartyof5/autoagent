/**
 * Isolated shopper/dealer thread book for preview and tests.
 *
 * Next route bundles do not share module memory, so the book is a temp file
 * on this machine (`isolated-preview-file`). It is not Supabase, not a live
 * rooftop, and not the demo seed. Every row carries FIXTURE_LABEL.
 * Production removal stays a recommendation in recordLiveDealerReply. This
 * book is the only place a third withhold warning removes a rooftop, and
 * only the fixture rooftop.
 */

import {
  chmodSync,
  closeSync,
  constants,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  isInboxFilter,
  itemizedOtdShareBody,
  itemizedTotalCents,
  matchesInboxFilter,
  type ItemizedOtdLines,
} from './format';
import { messageHasItemizedOtd, evaluateOtdWithhold, OTD_WARNING_LIMIT } from './otd-warnings';
import { presentFromConversation, toInboxItem } from './present';
import { isDuplicateDealerReply } from './reply-guard';
import { inNetworkOpener, shopperFirstNameOnly } from './rooftop-match';
import type {
  Conversation,
  ConversationDetail,
  DealerDemoError,
  InboxFilter,
  InboxItem,
  ThreadMessage,
} from './types';

export const FIXTURE_LABEL = 'TEST FIXTURE · isolated preview · not a live system';
export const FIXTURE_ROOFTOP_ID = 'fixroof_lakeside';
export const FIXTURE_ROOFTOP_NAME = 'Lakeside Honda · TEST FIXTURE';

const MESSAGE_LIMIT = 2000;

type DealerResult<T> = { ok: true; data: T } | { ok: false; error: DealerDemoError };

type RooftopState = {
  id: string;
  name: string;
  removedAt: string | null;
};

export type IsolatedThreadView = {
  id: string;
  shopperFirstName: string | null;
  opener: string;
  channel: 'in_app_message';
  messages: ThreadMessage[];
  networkRemoved: boolean;
  rooftopLabel: string;
  fixtureLabel: typeof FIXTURE_LABEL;
  source: 'test-owned';
  persistence: 'isolated-preview-file';
  liveSystems: false;
};

export type IsolatedFailure = {
  ok: false;
  status: number;
  error: { code: string; message: string };
};

const rooftop: RooftopState = {
  id: FIXTURE_ROOFTOP_ID,
  name: FIXTURE_ROOFTOP_NAME,
  removedAt: null,
};

let threads: Conversation[] = [];
let sequence = 1;
const replyKeys = new Map<string, Set<string>>();
const DEFAULT_BOOK_PATH = join(tmpdir(), 'drevvy-isolated-preview-threads.json');

/** Test suites set this so they do not share the preview server's book. */
export function isolatedBookPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.DREVYY_FIXTURE_BOOK?.trim();
  return override && override.length > 0 ? override : DEFAULT_BOOK_PATH;
}

type Book = {
  sequence: number;
  removedAt: string | null;
  threads: Conversation[];
  replyKeys: Record<string, string[]>;
};

function persist(): void {
  const savedKeys: Record<string, string[]> = {};
  for (const [id, keys] of replyKeys) savedKeys[id] = [...keys];
  const book: Book = {
    sequence,
    removedAt: rooftop.removedAt,
    threads,
    replyKeys: savedKeys,
  };
  const path = isolatedBookPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(book), { mode: 0o600 });
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {
    // The rename already replaced the book. Mode is best-effort.
  }
}

function hydrate(): void {
  try {
    const book = JSON.parse(readFileSync(isolatedBookPath(), 'utf8')) as Book;
    if (!book || !Array.isArray(book.threads)) return;
    threads = book.threads;
    sequence = typeof book.sequence === 'number' ? book.sequence : 1;
    rooftop.removedAt = typeof book.removedAt === 'string' ? book.removedAt : null;
    replyKeys.clear();
    for (const [id, keys] of Object.entries(book.replyKeys ?? {})) {
      if (Array.isArray(keys)) replyKeys.set(id, new Set(keys.filter((key) => typeof key === 'string')));
    }
  } catch {
    // No book yet. This bundle keeps its empty state until the first write.
  }
}

function withBookLock<T>(fn: () => T): T {
  const path = isolatedBookPath();
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const started = Date.now();
  let fd: number | undefined;
  for (;;) {
    try {
      fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > 5_000) unlinkSync(lockPath);
      } catch {
        // The holder released the lock between the stat and the unlink.
      }
      if (Date.now() - started > 2_000) {
        throw new Error('isolated fixture book is busy');
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    return fn();
  } finally {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(lockPath);
    } catch {
      // Another waiter may already have removed a stale lock.
    }
  }
}

function readBook<T>(fn: () => T): T {
  return withBookLock(() => {
    hydrate();
    return fn();
  });
}

function writeBook<T>(fn: () => T): T {
  return withBookLock(() => {
    hydrate();
    const value = fn();
    persist();
    return value;
  });
}

export function threadFixtureEnabled(
  env: { NODE_ENV?: string; DEALER_THREAD_FIXTURE?: string } = process.env,
): boolean {
  const nodeEnv = (env.NODE_ENV ?? '').trim().toLowerCase();
  return nodeEnv !== '' && nodeEnv !== 'production' && env.DEALER_THREAD_FIXTURE === '1';
}

/**
 * Live membership wins for any id that is not a fixture thread.
 * A fixture id never falls through to the live store while the flag is on.
 * With the flag off, a live member stays on the live store.
 */
export function deskWriteTarget(
  liveMembership: boolean,
  leadId: string,
  fixtureEnabled: boolean,
): 'live' | 'fixture' | 'mock' {
  if (liveMembership && !isIsolatedThreadId(leadId)) return 'live';
  if (fixtureEnabled && isIsolatedThreadId(leadId)) return 'fixture';
  if (liveMembership) return 'live';
  return 'mock';
}

export function isIsolatedThreadId(id: string): boolean {
  return id.startsWith('fixconv_');
}

export function resetIsolatedThreads(): void {
  writeBook(() => {
    threads = [];
    sequence = 1;
    replyKeys.clear();
    rooftop.removedAt = null;
  });
}

export function isolatedRooftopRemoved(): boolean {
  return readBook(() => rooftop.removedAt != null);
}

function fail(error: DealerDemoError): DealerResult<never> {
  return { ok: false, error };
}

function find(id: string): Conversation | undefined {
  return threads.find((thread) => thread.id === id);
}

function view(conversation: Conversation): IsolatedThreadView {
  return {
    id: conversation.id,
    shopperFirstName: conversation.shopperFirstName,
    opener: conversation.messages.find((message) => message.kind === 'opener')?.body
      ?? inNetworkOpener(conversation.shopperFirstName),
    channel: 'in_app_message',
    messages: conversation.messages.map((message) => ({ ...message })),
    networkRemoved: conversation.networkRemoved === true,
    rooftopLabel: FIXTURE_ROOFTOP_NAME,
    fixtureLabel: FIXTURE_LABEL,
    source: 'test-owned',
    persistence: 'isolated-preview-file',
    liveSystems: false,
  };
}

export function openIsolatedThread(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  financing?: boolean | null;
  network?: 'in_network' | 'off_network';
  now?: Date;
}): { ok: true; thread: IsolatedThreadView } | IsolatedFailure {
  if (input.network === 'off_network') {
    return {
      ok: false,
      status: 409,
      error: {
        code: 'not_chat',
        message: 'An off-network out-the-door request is not chat. No thread was created.',
      },
    };
  }
  return writeBook(() => openIsolatedThreadLocked(input));
}

function openIsolatedThreadLocked(input: {
  firstName?: string | null;
  zip?: string | null;
  financing?: boolean | null;
  now?: Date;
}): { ok: true; thread: IsolatedThreadView } | IsolatedFailure {
  if (rooftop.removedAt) {
    return {
      ok: false,
      status: 409,
      error: {
        code: 'network_removed',
        message: 'This test rooftop was removed from the isolated preview network after 3 withhold warnings. Live rooftops are not removed.',
      },
    };
  }
  const now = input.now ?? new Date();
  const first = shopperFirstNameOnly(input.firstName);
  const opener = inNetworkOpener(input.firstName, {
    financing: input.financing === true,
    zip: input.zip,
  });
  const id = `fixconv_${sequence.toString(16).padStart(4, '0')}`;
  sequence += 1;
  const conversation: Conversation = {
    id,
    shopperFirstName: first ?? 'A shopper',
    shopperRef: `#F${id.slice(-4).toUpperCase()}`,
    rooftopId: FIXTURE_ROOFTOP_ID,
    stage: 'new_request',
    vehicle: { year: 2024, make: 'Honda', model: 'CR-V', trim: 'EX' },
    stockNumber: 'TEST-FIXTURE',
    advertisedPriceCents: 3_290_000,
    statedPriceCents: null,
    writtenOtdCents: null,
    openedAt: now.toISOString(),
    firstReplyAt: null,
    replyDueAt: new Date(now.getTime() + 20 * 60_000).toISOString(),
    fixtureLabel: FIXTURE_LABEL,
    networkRemoved: false,
    otdWarningCount: 0,
    messages: [{
      id: `fixmsg_${sequence++}`,
      author: 'drevvy',
      kind: 'opener',
      body: opener,
      sentAt: now.toISOString(),
    }],
  };
  threads.unshift(conversation);
  return { ok: true, thread: view(conversation) };
}

export function isolatedShopperThread(id: string): IsolatedThreadView | null {
  return readBook(() => {
    const conversation = find(id);
    return conversation ? view(conversation) : null;
  });
}

export function postIsolatedShopperMessage(
  id: string,
  body: string,
  now = new Date(),
): { ok: true; thread: IsolatedThreadView } | IsolatedFailure {
  return writeBook(() => {
  const conversation = find(id);
  if (!conversation) {
    return { ok: false, status: 404, error: { code: 'not_found', message: 'That fixture thread does not exist.' } };
  }
  const text = body.trim();
  if (!text) {
    return { ok: false, status: 400, error: { code: 'empty_message', message: 'Write a message first.' } };
  }
  if (text.length > MESSAGE_LIMIT) {
    return { ok: false, status: 400, error: { code: 'message_too_long', message: 'That message is too long.' } };
  }
  conversation.messages.push({
    id: `fixmsg_${sequence++}`,
    author: 'shopper',
    kind: 'chat',
    body: text,
    sentAt: now.toISOString(),
  });
  return { ok: true, thread: view(conversation) };
  });
}

function planStrike(conversation: Conversation, dealerReply: string) {
  return evaluateOtdWithhold({
    shopperFirstName: conversation.shopperFirstName,
    messages: conversation.messages,
    dealerReply,
    warningCount: conversation.otdWarningCount ?? 0,
    removalRecommended: conversation.otdRemovalRecommended === true,
    comeInAdminFlag: conversation.comeInAdminFlag === true,
  });
}

function appendStrike(
  conversation: Conversation,
  result: ReturnType<typeof planStrike>,
  now: Date,
): void {
  if (result.comeInAdminFlag) conversation.comeInAdminFlag = true;
  if (result.replyItemized) conversation.otdWarningCount = result.warningCount;
  if (!result.warning) return;
  conversation.otdWarningCount = result.warningCount;
  const sentAt = now.toISOString();
  conversation.messages.push({
    id: `fixmsg_${sequence++}`,
    author: 'drevvy',
    kind: 'chat',
    body: result.warning,
    sentAt,
  });
  if (result.removalNotice) {
    conversation.otdRemovalRecommended = true;
    conversation.networkRemoved = true;
    rooftop.removedAt = sentAt;
    conversation.messages.push({
      id: `fixmsg_${sequence++}`,
      author: 'drevvy',
      kind: 'chat',
      body: result.removalNotice,
      sentAt,
    });
  }
}

export function postIsolatedDealerMessage(
  id: string,
  body: string,
  now = new Date(),
  idempotencyKey?: string | null,
): DealerResult<ConversationDetail> {
  return writeBook(() => {
  const conversation = find(id);
  if (!conversation) return fail('not_found');
  const text = body.trim();
  if (!text) return fail('empty_message');
  if (text.length > MESSAGE_LIMIT) return fail('message_too_long');
  const seen = replyKeys.get(id);
  if (isDuplicateDealerReply(conversation.messages, text, idempotencyKey, seen)) {
    return { ok: true, data: presentFromConversation(conversation, now) };
  }
  const strike = planStrike(conversation, text);
  conversation.messages.push({
    id: `fixmsg_${sequence++}`,
    author: 'salesperson',
    kind: 'chat',
    body: text,
    sentAt: now.toISOString(),
  });
  appendStrike(conversation, strike, now);
  if (!conversation.firstReplyAt) conversation.firstReplyAt = now.toISOString();
  if (conversation.stage === 'new_request') conversation.stage = 'in_conversation';
  const key = idempotencyKey?.trim();
  if (key) {
    const bucket = replyKeys.get(id) ?? new Set<string>();
    bucket.add(key);
    replyKeys.set(id, bucket);
  }
  return { ok: true, data: presentFromConversation(conversation, now) };
  });
}

export function shareIsolatedItemized(
  id: string,
  lines: ItemizedOtdLines,
  note: string,
  now = new Date(),
  writtenOtdCents: number | null = null,
): DealerResult<ConversationDetail> {
  const sum = itemizedTotalCents(lines);
  if (sum == null || (writtenOtdCents != null && writtenOtdCents !== sum)) return fail('invalid_price');
  return writeBook(() => {
  const conversation = find(id);
  if (!conversation) return fail('not_found');
  const numbersBody = itemizedOtdShareBody(lines, note);
  if (!messageHasItemizedOtd(numbersBody)) return fail('invalid_price');
  const strike = planStrike(conversation, numbersBody);
  conversation.messages.push({
    id: `fixmsg_${sequence++}`,
    author: 'salesperson',
    kind: 'numbers',
    body: numbersBody,
    sentAt: now.toISOString(),
  });
  conversation.statedPriceCents = lines.vehiclePriceCents;
  conversation.writtenOtdCents = sum;
  appendStrike(conversation, strike, now);
  if (!conversation.firstReplyAt) conversation.firstReplyAt = now.toISOString();
  if (conversation.stage === 'new_request' || conversation.stage === 'in_conversation') {
    conversation.stage = 'numbers_shared';
  }
  return { ok: true, data: presentFromConversation(conversation, now) };
  });
}

export function isolatedInboxItems(filter: InboxFilter, now = new Date()): InboxItem[] {
  return readBook(() => threads
    .map((conversation) => toInboxItem(conversation, now))
    .filter((item) => matchesInboxFilter(item, filter)));
}

export function isolatedConversation(id: string, now = new Date()): ConversationDetail | null {
  return readBook(() => {
    const conversation = find(id);
    return conversation ? presentFromConversation(conversation, now) : null;
  });
}

export function isolatedWarningCount(id: string): number {
  return readBook(() => find(id)?.otdWarningCount ?? 0);
}

export function isolatedStrikeLimit(): number {
  return OTD_WARNING_LIMIT;
}

function dealerErrorStatus(error: DealerDemoError): number {
  if (error === 'not_found') return 404;
  if (error === 'conversation_closed') return 409;
  return 400;
}

export function tryIsolatedDealerMessage(
  leadId: string,
  payload: unknown,
  now = new Date(),
  enabled = threadFixtureEnabled(),
): { status: number; body: unknown } | null {
  if (!isIsolatedThreadId(leadId)) return null;
  if (!enabled) return { status: 404, body: { error: 'not_found' } };
  const text = payload && typeof payload === 'object' && typeof (payload as { body?: unknown }).body === 'string'
    ? (payload as { body: string }).body
    : '';
  const key = payload && typeof payload === 'object' && typeof (payload as { idempotencyKey?: unknown }).idempotencyKey === 'string'
    ? (payload as { idempotencyKey: string }).idempotencyKey
    : null;
  const result = postIsolatedDealerMessage(leadId, text, now, key);
  if (!result.ok) return { status: dealerErrorStatus(result.error), body: { error: result.error } };
  return {
    status: 200,
    body: {
      source: 'test-owned',
      persistence: 'isolated-preview-file',
      fixtureLabel: FIXTURE_LABEL,
      liveSystems: false,
      conversation: result.data,
    },
  };
}

export function tryIsolatedDealerRead(
  leadId: string,
  now = new Date(),
  enabled = threadFixtureEnabled(),
): { status: number; body: unknown } | null {
  if (!isIsolatedThreadId(leadId)) return null;
  if (!enabled) return { status: 404, body: { error: 'not_found' } };
  const conversation = isolatedConversation(leadId, now);
  if (!conversation) return { status: 404, body: { error: 'not_found' } };
  return {
    status: 200,
    body: {
      source: 'test-owned',
      persistence: 'isolated-preview-file',
      fixtureLabel: FIXTURE_LABEL,
      liveSystems: false,
      conversation,
    },
  };
}

export function mergeIsolatedInbox(
  items: InboxItem[],
  filter: string,
  now = new Date(),
  enabled = threadFixtureEnabled(),
): InboxItem[] {
  if (!enabled || !isInboxFilter(filter)) return items;
  return [...isolatedInboxItems(filter, now), ...items];
}

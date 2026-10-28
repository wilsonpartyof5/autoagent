/**
 * Live dealer desk reads. Rooftop-scoped via user_dealerships.
 * Shopper identity is first name + opaque ref only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { shopperFirstNameOnly } from './rooftop-match';
import { presentFromConversation, toInboxItem } from './present';
import { evaluateOtdWithhold, recordLiveDealerReply } from './otd-warnings';
import {
  CLOSE_FEE_CENTS,
  CLOSE_FEE_COPY,
  isInboxFilter,
  isOpenStage,
  matchesInboxFilter,
  numbersShareBody,
  RANGE_LABEL,
  validCents,
} from './format';
import type { DealerSession } from './session';
import { sessionRooftopIds } from './session';
import type {
  AnalyticsRange,
  AnalyticsSummary,
  BillingSnapshot,
  CloseCharge,
  Conversation,
  ConversationDetail,
  ConversationStage,
  DealerDemoError,
  InboxFilter,
  InboxItem,
  MessageAuthor,
  MessageKind,
  ThreadMessage,
  VehicleSummary,
} from './types';

const MESSAGE_LIMIT = 2000;
const NOTE_LIMIT = 280;
const REPLY_WINDOW_MS = 60 * 60 * 1000;
const DEAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANGE_DAYS: Record<AnalyticsRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

export type DealerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DealerDemoError };

type ConversationRow = {
  deal_id: string;
  rooftop_id: string;
  shopper_first_name: string | null;
  opener: string | null;
  created_at: string;
  otd_warning_count: number | null;
  otd_itemized_at: string | null;
  otd_removal_recommended_at: string | null;
  come_in_admin_flag: boolean | null;
  first_reply_at: string | null;
  stated_price_cents: number | null;
  written_otd_cents: number | null;
  dealer_marked_sold_at: string | null;
};

type DealRow = {
  id: string;
  listing_id: string;
  status: string;
  vehicle_snapshot: unknown;
  created_at: string;
};

type MessageRow = {
  id: string;
  deal_id: string;
  author: string;
  kind: string;
  body: string;
  sent_at: string;
};

type WarningRow = {
  deal_id: string;
  warning_number: number | null;
  body: string;
  removal_notice: string | null;
  created_at: string;
};

type LifecycleRow = {
  deal_id: string;
  end_state: string | null;
  bought: boolean | null;
};

type CloseFeeRow = {
  deal_id: string;
  rooftop_id: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string;
};

export type LiveDeskBundle = {
  conversations: ConversationRow[];
  deals: DealRow[];
  messages: MessageRow[];
  warnings: WarningRow[];
  lifecycle: LifecycleRow[];
};

export function isDealId(value: string): boolean {
  return DEAL_ID.test(value);
}

export function shopperRefFromDealId(dealId: string): string {
  return `#${dealId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export function deskVehicleFromSnapshot(snapshot: unknown): {
  vehicle: VehicleSummary;
  advertisedPriceCents: number;
  stockNumber: string;
} {
  const record = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : {};
  const year = Number(record.year);
  const price = Number(record.price);
  const make = typeof record.make === 'string' ? record.make.trim() : '';
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  const trim = typeof record.trim === 'string' ? record.trim.trim() : '';
  const stock = typeof record.stockNumber === 'string' && record.stockNumber.trim()
    ? record.stockNumber.trim().slice(0, 24)
    : '—';
  return {
    vehicle: {
      year: Number.isFinite(year) ? Math.trunc(year) : 0,
      make: make || 'Vehicle',
      model: model || '',
      trim,
    },
    advertisedPriceCents: Number.isFinite(price) ? Math.round(price * 100) : 0,
    stockNumber: stock,
  };
}

export function deriveConversationStage(input: {
  dealStatus?: string | null;
  endState?: string | null;
  bought?: boolean | null;
  dealerMarkedSoldAt?: string | null;
  otdItemizedAt?: string | null;
  statedPriceCents?: number | null;
  firstReplyAt?: string | null;
  hasSalespersonMessage?: boolean;
}): ConversationStage {
  if (input.bought === true || input.endState === 'sold' || input.dealerMarkedSoldAt) {
    return 'car_sold';
  }
  if (input.endState === 'ended_no_response') return 'no_reply';
  if (input.dealStatus === 'closed' || input.endState === 'removed' || input.endState === 'dealer_declined') {
    return 'closed';
  }
  if (input.otdItemizedAt || (input.statedPriceCents != null && input.statedPriceCents > 0)) {
    return 'numbers_shared';
  }
  if (input.firstReplyAt || input.hasSalespersonMessage) return 'in_conversation';
  return 'new_request';
}

function isAuthor(value: string): value is MessageAuthor {
  return value === 'drevvy' || value === 'shopper' || value === 'salesperson';
}

function isKind(value: string): value is MessageKind {
  return value === 'chat' || value === 'opener' || value === 'numbers';
}

export function assembleThread(input: {
  opener: string;
  openedAt: string;
  messages: MessageRow[];
  warnings: WarningRow[];
}): ThreadMessage[] {
  const persisted = input.messages
    .slice()
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id))
    .flatMap((row) => {
      if (!row.body.trim() || !isAuthor(row.author) || !isKind(row.kind)) return [];
      return [{
        id: row.id,
        author: row.author,
        kind: row.kind,
        body: row.body,
        sentAt: row.sent_at,
      }];
    });
  if (persisted.length > 0) return persisted;

  const synthesized: ThreadMessage[] = [{
    id: 'opener',
    author: 'drevvy',
    kind: 'opener',
    body: input.opener,
    sentAt: input.openedAt,
  }];
  for (const warning of input.warnings.slice().sort((a, b) => (a.warning_number ?? 0) - (b.warning_number ?? 0))) {
    synthesized.push({
      id: `warn-${warning.warning_number ?? synthesized.length}`,
      author: 'drevvy',
      kind: 'chat',
      body: warning.body,
      sentAt: warning.created_at,
    });
    if (warning.removal_notice) {
      synthesized.push({
        id: `warn-${warning.warning_number ?? synthesized.length}-removal`,
        author: 'drevvy',
        kind: 'chat',
        body: warning.removal_notice,
        sentAt: warning.created_at,
      });
    }
  }
  return synthesized;
}

export function assembleLiveConversation(
  row: ConversationRow,
  deal: DealRow | null,
  messages: MessageRow[],
  warnings: WarningRow[],
  lifecycle: LifecycleRow | null,
): Conversation {
  const desk = deskVehicleFromSnapshot(deal?.vehicle_snapshot);
  const firstName = shopperFirstNameOnly(row.shopper_first_name) ?? 'A shopper';
  const thread = assembleThread({
    opener: row.opener?.trim() || `${firstName} wants your best itemized out-the-door`,
    openedAt: row.created_at,
    messages,
    warnings,
  });
  const firstReplyAt = row.first_reply_at
    ?? thread.find((message) => message.author === 'salesperson')?.sentAt
    ?? null;
  const stage = deriveConversationStage({
    dealStatus: deal?.status,
    endState: lifecycle?.end_state,
    bought: lifecycle?.bought,
    dealerMarkedSoldAt: row.dealer_marked_sold_at,
    otdItemizedAt: row.otd_itemized_at,
    statedPriceCents: row.stated_price_cents,
    firstReplyAt,
    hasSalespersonMessage: thread.some((message) => message.author === 'salesperson'),
  });
  const openedAt = row.created_at;
  return {
    id: row.deal_id,
    shopperFirstName: firstName,
    shopperRef: shopperRefFromDealId(row.deal_id),
    rooftopId: row.rooftop_id,
    stage,
    vehicle: desk.vehicle,
    stockNumber: desk.stockNumber,
    advertisedPriceCents: desk.advertisedPriceCents,
    statedPriceCents: row.stated_price_cents,
    writtenOtdCents: row.written_otd_cents,
    openedAt,
    firstReplyAt,
    replyDueAt: new Date(Date.parse(openedAt) + REPLY_WINDOW_MS).toISOString(),
    messages: thread,
    otdWarningCount: row.otd_warning_count ?? 0,
    otdRemovalRecommended: row.otd_removal_recommended_at != null,
    comeInAdminFlag: row.come_in_admin_flag === true,
  };
}

export function assembleLiveInbox(
  bundle: LiveDeskBundle,
  filter: InboxFilter,
  now: Date,
): InboxItem[] {
  const deals = new Map(bundle.deals.map((row) => [row.id, row]));
  const lifecycle = new Map(bundle.lifecycle.map((row) => [row.deal_id, row]));
  const messages = groupBy(bundle.messages, (row) => row.deal_id);
  const warnings = groupBy(bundle.warnings, (row) => row.deal_id);
  return bundle.conversations
    .map((row) => assembleLiveConversation(
      row,
      deals.get(row.deal_id) ?? null,
      messages.get(row.deal_id) ?? [],
      warnings.get(row.deal_id) ?? [],
      lifecycle.get(row.deal_id) ?? null,
    ))
    .map((conversation) => toInboxItem(conversation, now))
    .filter((item) => matchesInboxFilter(item, filter))
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

export function assembleLiveAnalytics(
  conversations: Conversation[],
  range: AnalyticsRange,
  now: Date,
): AnalyticsSummary {
  const start = now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const inRange = conversations.filter((conversation) => Date.parse(conversation.openedAt) >= start);
  const replied = inRange.filter((conversation) => conversation.firstReplyAt);
  const replyMinutes = replied
    .map((conversation) => (
      (Date.parse(conversation.firstReplyAt!) - Date.parse(conversation.openedAt)) / 60_000
    ))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const closed = inRange.filter((conversation) => !isOpenStage(conversation.stage));
  const numbersShared = inRange.filter((conversation) => (
    conversation.stage === 'numbers_shared'
    || conversation.statedPriceCents != null
    || conversation.writtenOtdCents != null
    || conversation.messages.some((message) => message.kind === 'numbers')
  ));
  return {
    source: 'live',
    range,
    rangeLabel: RANGE_LABEL[range],
    replyRate: inRange.length === 0 ? 0 : replied.length / inRange.length,
    medianFirstReplyMinutes: median(replyMinutes),
    conversationsStarted: inRange.length,
    conversationsClosed: closed.length,
    numbersShared: numbersShared.length,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return Math.round(values[mid]);
  return Math.round((values[mid - 1] + values[mid]) / 2);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = grouped.get(id);
    if (list) list.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}

function fail(error: DealerDemoError): DealerResult<never> {
  return { ok: false, error };
}

function adminOrNull(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function selectIn<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from(table).select(columns).in(column, ids);
  if (error) {
    if (/does not exist|schema cache|column/i.test(error.message)) return [];
    console.error(JSON.stringify({ event: 'dealer_desk_query_failed', table, message: error.message }));
    return [];
  }
  return (data ?? []) as T[];
}

export async function loadLiveDeskBundle(
  rooftopIds: string[],
  dealId?: string,
): Promise<LiveDeskBundle | null> {
  const supabase = adminOrNull();
  if (!supabase || rooftopIds.length === 0) return null;

  let query = supabase
    .from('shopper_dealer_conversations')
    .select('deal_id, rooftop_id, shopper_first_name, opener, created_at, otd_warning_count, otd_itemized_at, otd_removal_recommended_at, come_in_admin_flag, first_reply_at, stated_price_cents, written_otd_cents, dealer_marked_sold_at')
    .in('rooftop_id', rooftopIds)
    .order('created_at', { ascending: false });
  if (dealId) query = query.eq('deal_id', dealId);

  const loaded = await query;
  if (loaded.error) {
    console.error(JSON.stringify({
      event: 'dealer_inbox_failed',
      message: loaded.error.message,
    }));
    return null;
  }

  const conversations = ((loaded.data ?? []) as ConversationRow[]).filter((row) => isDealId(row.deal_id));
  const dealIds = conversations.map((row) => row.deal_id);
  const [deals, messages, warnings, lifecycle] = await Promise.all([
    selectIn<DealRow>(supabase, 'shopper_deals', 'id, listing_id, status, vehicle_snapshot, created_at', 'id', dealIds),
    selectIn<MessageRow>(supabase, 'shopper_dealer_messages', 'id, deal_id, author, kind, body, sent_at', 'deal_id', dealIds),
    selectIn<WarningRow>(supabase, 'dealer_otd_warnings', 'deal_id, warning_number, body, removal_notice, created_at', 'deal_id', dealIds),
    selectIn<LifecycleRow>(supabase, 'shopper_deal_lifecycle', 'deal_id, end_state, bought', 'deal_id', dealIds),
  ]);

  return { conversations, deals, messages, warnings, lifecycle };
}

function conversationsFromBundle(bundle: LiveDeskBundle): Conversation[] {
  const deals = new Map(bundle.deals.map((row) => [row.id, row]));
  const lifecycle = new Map(bundle.lifecycle.map((row) => [row.deal_id, row]));
  const messages = groupBy(bundle.messages, (row) => row.deal_id);
  const warnings = groupBy(bundle.warnings, (row) => row.deal_id);
  return bundle.conversations.map((row) => assembleLiveConversation(
    row,
    deals.get(row.deal_id) ?? null,
    messages.get(row.deal_id) ?? [],
    warnings.get(row.deal_id) ?? [],
    lifecycle.get(row.deal_id) ?? null,
  ));
}

export async function listLiveInbox(
  session: DealerSession,
  filter: InboxFilter,
  rooftopId: string | null,
  now = new Date(),
): Promise<InboxItem[] | null> {
  const ids = sessionRooftopIds(session, rooftopId);
  const bundle = await loadLiveDeskBundle(ids);
  if (!bundle) return null;
  return assembleLiveInbox(bundle, filter, now);
}

export async function presentLiveConversation(
  session: DealerSession,
  dealId: string,
  now = new Date(),
): Promise<ConversationDetail | null> {
  if (!isDealId(dealId)) return null;
  const bundle = await loadLiveDeskBundle(sessionRooftopIds(session), dealId);
  if (!bundle || bundle.conversations.length === 0) return null;
  const conversation = conversationsFromBundle(bundle)[0];
  return conversation ? presentFromConversation(conversation, now) : null;
}

export async function liveAnalytics(
  session: DealerSession,
  range: AnalyticsRange,
  rooftopId: string | null,
  now = new Date(),
): Promise<AnalyticsSummary | null> {
  const bundle = await loadLiveDeskBundle(sessionRooftopIds(session, rooftopId));
  if (!bundle) return null;
  return assembleLiveAnalytics(conversationsFromBundle(bundle), range, now);
}

export async function liveBilling(
  session: DealerSession,
): Promise<BillingSnapshot | null> {
  const supabase = adminOrNull();
  if (!supabase) return null;
  const ids = sessionRooftopIds(session);
  const fees = await selectIn<CloseFeeRow>(
    supabase,
    'dealer_close_fees',
    'deal_id, rooftop_id, amount_cents, status, created_at',
    'rooftop_id',
    ids,
  );
  const dealIds = fees.map((row) => row.deal_id);
  const deals = await selectIn<DealRow>(
    supabase,
    'shopper_deals',
    'id, listing_id, status, vehicle_snapshot, created_at',
    'id',
    dealIds,
  );
  const dealMap = new Map(deals.map((row) => [row.id, row]));
  const charges: CloseCharge[] = fees
    .map((row) => {
      const deal = dealMap.get(row.deal_id);
      const desk = deskVehicleFromSnapshot(deal?.vehicle_snapshot);
      const status: CloseCharge['status'] = row.status === 'due' || row.status === 'invoiced' || row.status === 'paid' || row.status === 'void'
        ? row.status
        : 'due';
      return {
        id: row.deal_id,
        conversationId: row.deal_id,
        shopperRef: shopperRefFromDealId(row.deal_id),
        vehicleTitle: `${desk.vehicle.year} ${desk.vehicle.make} ${desk.vehicle.model} ${desk.vehicle.trim}`.trim(),
        amountCents: row.amount_cents ?? CLOSE_FEE_CENTS,
        status,
        closedAt: row.created_at,
      };
    })
    .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));

  return {
    source: 'live',
    role: session.role,
    dayToDay: 'free',
    closeFeeCents: CLOSE_FEE_CENTS,
    closeFeeLabel: CLOSE_FEE_COPY,
    paymentMethod: { brand: 'Visa', last4: '4242', placeholder: true },
    charges,
  };
}

async function ensureOpener(
  supabase: SupabaseClient,
  conversation: Conversation,
): Promise<void> {
  const opener = conversation.messages.find((message) => message.kind === 'opener');
  if (!opener) return;
  const existing = await supabase
    .from('shopper_dealer_messages')
    .select('id')
    .eq('deal_id', conversation.id)
    .eq('kind', 'opener')
    .limit(1);
  if (existing.error || (existing.data ?? []).length > 0) return;
  await supabase.from('shopper_dealer_messages').insert({
    deal_id: conversation.id,
    author: 'drevvy',
    kind: 'opener',
    body: opener.body,
    sent_at: opener.sentAt,
  });
}

async function insertThreadMessage(
  supabase: SupabaseClient,
  dealId: string,
  message: Omit<ThreadMessage, 'id'>,
): Promise<void> {
  const saved = await supabase.from('shopper_dealer_messages').insert({
    deal_id: dealId,
    author: message.author,
    kind: message.kind,
    body: message.body,
    sent_at: message.sentAt,
  });
  if (saved.error && !/does not exist|schema cache/i.test(saved.error.message)) {
    console.error(JSON.stringify({
      event: 'dealer_message_insert_failed',
      dealId,
      message: saved.error.message,
    }));
  }
}

async function patchConversation(
  supabase: SupabaseClient,
  dealId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const updated = await supabase.from('shopper_dealer_conversations').update(patch).eq('deal_id', dealId);
  if (updated.error && !/does not exist|schema cache|column/i.test(updated.error.message)) {
    console.error(JSON.stringify({
      event: 'dealer_conversation_patch_failed',
      dealId,
      message: updated.error.message,
    }));
  }
}

async function afterDealerReply(
  supabase: SupabaseClient,
  conversation: Conversation,
  dealerReply: string,
  now: Date,
): Promise<void> {
  const strike = evaluateOtdWithhold({
    shopperFirstName: conversation.shopperFirstName,
    messages: conversation.messages,
    dealerReply,
    warningCount: conversation.otdWarningCount ?? 0,
    removalRecommended: conversation.otdRemovalRecommended === true,
    comeInAdminFlag: conversation.comeInAdminFlag === true,
  });
  await recordLiveDealerReply(supabase, conversation.id, dealerReply);
  if (strike.warning) {
    await insertThreadMessage(supabase, conversation.id, {
      author: 'drevvy',
      kind: 'chat',
      body: strike.warning,
      sentAt: now.toISOString(),
    });
  }
  if (strike.removalNotice) {
    await insertThreadMessage(supabase, conversation.id, {
      author: 'drevvy',
      kind: 'chat',
      body: strike.removalNotice,
      sentAt: now.toISOString(),
    });
  }
}

async function mutateLive(
  session: DealerSession,
  dealId: string,
  now: Date,
  work: (supabase: SupabaseClient, conversation: Conversation) => Promise<DealerResult<void>>,
): Promise<DealerResult<ConversationDetail>> {
  const presented = await presentLiveConversation(session, dealId, now);
  if (!presented) return fail('not_found');
  const supabase = adminOrNull();
  if (!supabase) return fail('not_found');
  await ensureOpener(supabase, presented);
  const result = await work(supabase, presented);
  if (!result.ok) return result;
  const next = await presentLiveConversation(session, dealId, now);
  if (!next) return fail('not_found');
  return { ok: true, data: next };
}

export async function postLiveMessage(
  session: DealerSession,
  dealId: string,
  body: string,
  now = new Date(),
): Promise<DealerResult<ConversationDetail>> {
  const text = body.trim();
  if (!text) return fail('empty_message');
  if (text.length > MESSAGE_LIMIT) return fail('message_too_long');
  return mutateLive(session, dealId, now, async (supabase, conversation) => {
    const sentAt = now.toISOString();
    await insertThreadMessage(supabase, conversation.id, {
      author: 'salesperson',
      kind: 'chat',
      body: text,
      sentAt,
    });
    const patch: Record<string, unknown> = {};
    if (!conversation.firstReplyAt) patch.first_reply_at = sentAt;
    if (Object.keys(patch).length > 0) await patchConversation(supabase, conversation.id, patch);
    await afterDealerReply(supabase, conversation, text, now);
    return { ok: true, data: undefined };
  });
}

export async function shareLiveNumbers(
  session: DealerSession,
  dealId: string,
  input: { statedPriceCents: number; writtenOtdCents: number | null; note: string },
  now = new Date(),
): Promise<DealerResult<ConversationDetail>> {
  if (!validCents(input.statedPriceCents)) return fail('invalid_price');
  if (input.writtenOtdCents != null && !validCents(input.writtenOtdCents)) return fail('invalid_price');
  const note = input.note.trim();
  if (note.length > NOTE_LIMIT) return fail('invalid_price');
  return mutateLive(session, dealId, now, async (supabase, conversation) => {
    if (!isOpenStage(conversation.stage)) return fail('conversation_closed');
    const sentAt = now.toISOString();
    const numbersBody = numbersShareBody({
      advertisedPriceCents: conversation.advertisedPriceCents,
      statedPriceCents: input.statedPriceCents,
      writtenOtdCents: input.writtenOtdCents,
      note,
    });
    await insertThreadMessage(supabase, conversation.id, {
      author: 'salesperson',
      kind: 'numbers',
      body: numbersBody,
      sentAt,
    });
    const patch: Record<string, unknown> = {
      stated_price_cents: input.statedPriceCents,
      written_otd_cents: input.writtenOtdCents,
    };
    if (!conversation.firstReplyAt) patch.first_reply_at = sentAt;
    await patchConversation(supabase, conversation.id, patch);
    await afterDealerReply(supabase, conversation, numbersBody, now);
    return { ok: true, data: undefined };
  });
}

export async function markLiveSold(
  session: DealerSession,
  dealId: string,
  now = new Date(),
): Promise<DealerResult<ConversationDetail>> {
  return mutateLive(session, dealId, now, async (supabase, conversation) => {
    if (!isOpenStage(conversation.stage)) return fail('conversation_closed');
    await patchConversation(supabase, conversation.id, {
      dealer_marked_sold_at: now.toISOString(),
    });
    return { ok: true, data: undefined };
  });
}

export function parseInboxFilter(url: string): InboxFilter | null {
  const filter = new URL(url).searchParams.get('filter') ?? 'needs_reply';
  return isInboxFilter(filter) ? filter : null;
}

export function parseAnalyticsRange(url: string): AnalyticsRange | null {
  const range = new URL(url).searchParams.get('range') ?? '7d';
  return range === '7d' || range === '30d' || range === '90d' ? range : null;
}

export function parseRooftopQuery(url: string): string | null {
  const value = new URL(url).searchParams.get('rooftopId');
  return value && value.trim() ? value.trim() : null;
}

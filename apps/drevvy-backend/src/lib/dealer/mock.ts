/**
 * In-memory dealer desk. Process-local mock for /api/dealer/v1 and /dealer.
 * Dealers see first name only plus a conversation ref. Never last name,
 * phone, email, address, or city.
 * The first message is the Get Best Price template. Later messages are freeform
 * chat inside Drevvy. This desk does not send Telnyx text, email, or calls.
 * A salesperson reply moves New request to In conversation.
 * Share numbers records an informational chat message, not a binding offer.
 * Closed, Car sold, and No reply stay closed.
 */

import {
  bestPriceOpener,
  CLOSE_FEE_CENTS,
  CLOSE_FEE_COPY,
  isInboxFilter,
  isOpenStage,
  matchesInboxFilter,
  needsReply,
  numbersShareBody,
  pricesDiffer,
  replyTemplates,
  slaChip,
  snippetFrom,
  STAGE_LABEL,
  validCents,
  vehicleTitle,
  RANGE_LABEL,
} from './format';
import type {
  AnalyticsRange,
  AnalyticsSummary,
  BillingSnapshot,
  CloseCharge,
  Conversation,
  ConversationDetail,
  DealerDemoError,
  InboxFilter,
  InboxItem,
} from './types';

const MESSAGE_LIMIT = 2000;
const NOTE_LIMIT = 280;

let conversations: Conversation[] | null = null;
let closeCharges: CloseCharge[] | null = null;
let sequence = 1;

function at(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function buildSeed(now: Date): Conversation[] {
  const tucsonAdvertised = 3_618_000;
  const tucsonStated = 3_540_000;
  const tucsonOtd = 3_895_000;
  const tucsonOpened = at(now, -26 * 60);
  return [
    {
      id: 'conv_rav4',
      shopperFirstName: 'Jordan',
      shopperRef: '#A7F2',
      rooftopId: 'lakeside',
      stage: 'new_request',
      vehicle: {
        year: 2024,
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE Premium',
      },
      stockNumber: 'R44118',
      advertisedPriceCents: 3_324_000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: at(now, -40),
      firstReplyAt: null,
      replyDueAt: at(now, 20),
      messages: [
        {
          id: 'rav4-1',
          author: 'drevvy',
          kind: 'opener',
          body: bestPriceOpener({
            shopperFirstName: 'Jordan',
            stockNumber: 'R44118',
            vehicleTitle: '2024 Toyota RAV4 XLE Premium',
            advertisedPriceCents: 3_324_000,
          }),
          sentAt: at(now, -40),
        },
      ],
    },
    {
      id: 'conv_f150',
      shopperFirstName: 'Sam',
      shopperRef: '#B3C1',
      rooftopId: 'lakeside',
      stage: 'in_conversation',
      vehicle: { year: 2023, make: 'Ford', model: 'F-150', trim: 'XLT' },
      stockNumber: 'F31802',
      advertisedPriceCents: 4_150_000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: at(now, -180),
      firstReplyAt: at(now, -150),
      replyDueAt: at(now, -12),
      messages: [
        {
          id: 'f150-1',
          author: 'drevvy',
          kind: 'opener',
          body: bestPriceOpener({
            shopperFirstName: 'Sam',
            stockNumber: 'F31802',
            vehicleTitle: '2023 Ford F-150 XLT',
            advertisedPriceCents: 4_150_000,
          }),
          sentAt: at(now, -180),
        },
        {
          id: 'f150-2',
          author: 'salesperson',
          kind: 'chat',
          body: 'Yes, that truck is here.',
          sentAt: at(now, -150),
        },
        {
          id: 'f150-3',
          author: 'shopper',
          kind: 'chat',
          body: 'Can you share the advertised price and a written out-the-door total in this chat?',
          sentAt: at(now, -20),
        },
      ],
    },
    {
      id: 'conv_tucson',
      shopperFirstName: 'Avery',
      shopperRef: '#C9D4',
      rooftopId: 'lakeside',
      stage: 'numbers_shared',
      vehicle: {
        year: 2025,
        make: 'Hyundai',
        model: 'Tucson',
        trim: 'Limited',
      },
      stockNumber: 'T55290',
      advertisedPriceCents: tucsonAdvertised,
      statedPriceCents: tucsonStated,
      writtenOtdCents: tucsonOtd,
      openedAt: tucsonOpened,
      firstReplyAt: at(now, -26 * 60 + 35),
      replyDueAt: at(now, 120),
      messages: [
        {
          id: 'tucson-1',
          author: 'drevvy',
          kind: 'opener',
          body: bestPriceOpener({
            shopperFirstName: 'Avery',
            stockNumber: 'T55290',
            vehicleTitle: '2025 Hyundai Tucson Limited',
            advertisedPriceCents: tucsonAdvertised,
          }),
          sentAt: tucsonOpened,
        },
        {
          id: 'tucson-2',
          author: 'salesperson',
          kind: 'chat',
          body: 'Yes. I can share numbers here.',
          sentAt: at(now, -26 * 60 + 35),
        },
        {
          id: 'tucson-3',
          author: 'salesperson',
          kind: 'numbers',
          body: numbersShareBody({
            advertisedPriceCents: tucsonAdvertised,
            statedPriceCents: tucsonStated,
            writtenOtdCents: tucsonOtd,
            note: 'Written total includes the doc fee I usually use at this rooftop.',
          }),
          sentAt: at(now, -20 * 60),
        },
      ],
    },
    {
      id: 'conv_sportage',
      shopperFirstName: 'Casey',
      shopperRef: '#D2E8',
      rooftopId: 'airport',
      stage: 'car_sold',
      vehicle: { year: 2024, make: 'Kia', model: 'Sportage', trim: 'SX' },
      stockNumber: 'K44901',
      advertisedPriceCents: 3_129_000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: at(now, -2 * 24 * 60),
      firstReplyAt: at(now, -2 * 24 * 60 + 18),
      replyDueAt: at(now, -2 * 24 * 60 + 60),
      messages: [
        {
          id: 'sportage-1',
          author: 'drevvy',
          kind: 'opener',
          body: bestPriceOpener({
            shopperFirstName: 'Casey',
            stockNumber: 'K44901',
            vehicleTitle: '2024 Kia Sportage SX',
            advertisedPriceCents: 3_129_000,
          }),
          sentAt: at(now, -2 * 24 * 60),
        },
        {
          id: 'sportage-2',
          author: 'salesperson',
          kind: 'chat',
          body: 'That Sportage has sold.',
          sentAt: at(now, -2 * 24 * 60 + 18),
        },
      ],
    },
    {
      id: 'conv_outback',
      shopperFirstName: 'Riley',
      shopperRef: '#E4A1',
      rooftopId: 'midtown',
      stage: 'closed',
      vehicle: {
        year: 2022,
        make: 'Subaru',
        model: 'Outback',
        trim: 'Limited',
      },
      stockNumber: 'S22014',
      advertisedPriceCents: 2_844_000,
      statedPriceCents: 2_844_000,
      writtenOtdCents: 3_102_000,
      openedAt: at(now, -3 * 24 * 60),
      firstReplyAt: at(now, -3 * 24 * 60 + 12),
      replyDueAt: at(now, -3 * 24 * 60 + 60),
      messages: [
        {
          id: 'outback-1',
          author: 'drevvy',
          kind: 'opener',
          body: bestPriceOpener({
            shopperFirstName: 'Riley',
            stockNumber: 'S22014',
            vehicleTitle: '2022 Subaru Outback Limited',
            advertisedPriceCents: 2_844_000,
          }),
          sentAt: at(now, -3 * 24 * 60),
        },
        {
          id: 'outback-2',
          author: 'salesperson',
          kind: 'chat',
          body: 'Yes, it is here.',
          sentAt: at(now, -3 * 24 * 60 + 12),
        },
        {
          id: 'outback-3',
          author: 'shopper',
          kind: 'chat',
          body: 'Thanks, that is what I needed for now.',
          sentAt: at(now, -3 * 24 * 60 + 40),
        },
        {
          id: 'outback-4',
          author: 'salesperson',
          kind: 'chat',
          body: 'Glad we could talk here. I will leave this conversation closed.',
          sentAt: at(now, -3 * 24 * 60 + 48),
        },
      ],
    },
    {
      id: 'conv_tahoe',
      shopperFirstName: 'Morgan',
      shopperRef: '#F6B0',
      rooftopId: 'lakeside',
      stage: 'no_reply',
      vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe', trim: 'LT' },
      stockNumber: 'C19077',
      advertisedPriceCents: 4_680_000,
      statedPriceCents: null,
      writtenOtdCents: null,
      openedAt: at(now, -5 * 24 * 60),
      firstReplyAt: null,
      replyDueAt: at(now, -5 * 24 * 60 + 30),
      messages: [
        {
          id: 'tahoe-1',
          author: 'drevvy',
          kind: 'opener',
          body: bestPriceOpener({
            shopperFirstName: 'Morgan',
            stockNumber: 'C19077',
            vehicleTitle: '2021 Chevrolet Tahoe LT',
            advertisedPriceCents: 4_680_000,
          }),
          sentAt: at(now, -5 * 24 * 60),
        },
      ],
    },
  ];
}

function store(now = new Date()): Conversation[] {
  if (!conversations) conversations = buildSeed(now);
  return conversations;
}

function seedCharges(now: Date): CloseCharge[] {
  return [
    {
      id: 'chg_sportage',
      conversationId: 'conv_sportage',
      shopperRef: '#D2E8',
      vehicleTitle: '2024 Kia Sportage SX',
      amountCents: CLOSE_FEE_CENTS,
      status: 'placeholder',
      closedAt: at(now, -2 * 24 * 60),
    },
  ];
}

export function resetDealerDemo(now = new Date()): void {
  conversations = buildSeed(now);
  closeCharges = seedCharges(now);
  sequence = 1;
}

function charges(now = new Date()): CloseCharge[] {
  if (!closeCharges) closeCharges = seedCharges(now);
  return closeCharges;
}

export function listCloseCharges(now = new Date()): CloseCharge[] {
  return charges(now)
    .map(charge => ({ ...charge }))
    .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));
}

export function billingSnapshot(now = new Date()): BillingSnapshot {
  return {
    source: 'mock',
    role: 'owner_gm',
    dayToDay: 'free',
    closeFeeCents: CLOSE_FEE_CENTS,
    closeFeeLabel: CLOSE_FEE_COPY,
    paymentMethod: { brand: 'Visa', last4: '4242', placeholder: true },
    charges: listCloseCharges(now),
  };
}

function find(id: string): Conversation | undefined {
  return store().find(conversation => conversation.id === id);
}

export function toInboxItem(conversation: Conversation, now: Date): InboxItem {
  return {
    id: conversation.id,
    shopperFirstName: conversation.shopperFirstName,
    shopperRef: conversation.shopperRef,
    rooftopId: conversation.rooftopId,
    stage: conversation.stage,
    stageLabel: STAGE_LABEL[conversation.stage],
    vehicleTitle: vehicleTitle(conversation.vehicle),
    stockNumber: conversation.stockNumber,
    advertisedPriceCents: conversation.advertisedPriceCents,
    statedPriceCents: conversation.statedPriceCents,
    priceDiffers: pricesDiffer(
      conversation.advertisedPriceCents,
      conversation.statedPriceCents
    ),
    snippet: snippetFrom(conversation),
    needsReply: needsReply(conversation),
    openedAt: conversation.openedAt,
    replyDueAt: conversation.replyDueAt,
    sla: slaChip(conversation, now),
  };
}

export function presentConversation(
  id: string,
  now = new Date()
): ConversationDetail | null {
  const conversation = find(id);
  if (!conversation) return null;
  return {
    ...conversation,
    messages: conversation.messages.map(message => ({ ...message })),
    vehicleTitle: vehicleTitle(conversation.vehicle),
    stageLabel: STAGE_LABEL[conversation.stage],
    priceDiffers: pricesDiffer(
      conversation.advertisedPriceCents,
      conversation.statedPriceCents
    ),
    needsReply: needsReply(conversation),
    snippet: snippetFrom(conversation),
    sla: slaChip(conversation, now),
    replyTemplates: replyTemplates(conversation),
  };
}

export function allInboxItems(now = new Date()): InboxItem[] {
  return store(now)
    .map(conversation => toInboxItem(conversation, now))
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

export function listInbox(filter: InboxFilter, now = new Date()): InboxItem[] {
  return allInboxItems(now).filter(item => matchesInboxFilter(item, filter));
}

export type DealerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DealerDemoError };

function fail(error: DealerDemoError): DealerResult<never> {
  return { ok: false, error };
}

export function postMessage(
  id: string,
  body: string,
  now = new Date()
): DealerResult<ConversationDetail> {
  const conversation = find(id);
  if (!conversation) return fail('not_found');
  const text = body.trim();
  if (!text) return fail('empty_message');
  if (text.length > MESSAGE_LIMIT) return fail('message_too_long');

  conversation.messages.push({
    id: `local-${sequence++}`,
    author: 'salesperson',
    kind: 'chat',
    body: text,
    sentAt: now.toISOString(),
  });
  if (!conversation.firstReplyAt) conversation.firstReplyAt = now.toISOString();
  if (conversation.stage === 'new_request') {
    conversation.stage = 'in_conversation';
  }
  return { ok: true, data: presentConversation(id, now)! };
}

export function shareNumbers(
  id: string,
  input: {
    statedPriceCents: number;
    writtenOtdCents: number | null;
    note: string;
  },
  now = new Date()
): DealerResult<ConversationDetail> {
  const conversation = find(id);
  if (!conversation) return fail('not_found');
  if (!isOpenStage(conversation.stage)) return fail('conversation_closed');
  if (!validCents(input.statedPriceCents)) return fail('invalid_price');
  if (input.writtenOtdCents != null && !validCents(input.writtenOtdCents)) {
    return fail('invalid_price');
  }
  const note = input.note.trim();
  if (note.length > NOTE_LIMIT) return fail('invalid_price');

  conversation.statedPriceCents = input.statedPriceCents;
  conversation.writtenOtdCents = input.writtenOtdCents;
  conversation.messages.push({
    id: `local-${sequence++}`,
    author: 'salesperson',
    kind: 'numbers',
    body: numbersShareBody({
      advertisedPriceCents: conversation.advertisedPriceCents,
      statedPriceCents: input.statedPriceCents,
      writtenOtdCents: input.writtenOtdCents,
      note,
    }),
    sentAt: now.toISOString(),
  });
  if (!conversation.firstReplyAt) conversation.firstReplyAt = now.toISOString();
  if (
    conversation.stage === 'new_request' ||
    conversation.stage === 'in_conversation'
  ) {
    conversation.stage = 'numbers_shared';
  }
  return { ok: true, data: presentConversation(id, now)! };
}

export function markSold(
  id: string,
  now = new Date()
): DealerResult<ConversationDetail> {
  const conversation = find(id);
  if (!conversation) return fail('not_found');
  if (!isOpenStage(conversation.stage)) return fail('conversation_closed');
  conversation.stage = 'car_sold';
  charges(now).push({
    id: `chg-${sequence++}`,
    conversationId: conversation.id,
    shopperRef: conversation.shopperRef,
    vehicleTitle: vehicleTitle(conversation.vehicle),
    amountCents: CLOSE_FEE_CENTS,
    status: 'placeholder',
    closedAt: now.toISOString(),
  });
  return { ok: true, data: presentConversation(id, now)! };
}

const ANALYTICS: Record<
  AnalyticsRange,
  Omit<AnalyticsSummary, 'source' | 'range' | 'rangeLabel'>
> = {
  '7d': {
    replyRate: 0.82,
    medianFirstReplyMinutes: 16,
    conversationsStarted: 11,
    conversationsClosed: 4,
    numbersShared: 6,
  },
  '30d': {
    replyRate: 0.76,
    medianFirstReplyMinutes: 21,
    conversationsStarted: 38,
    conversationsClosed: 17,
    numbersShared: 22,
  },
  '90d': {
    replyRate: 0.71,
    medianFirstReplyMinutes: 27,
    conversationsStarted: 104,
    conversationsClosed: 49,
    numbersShared: 61,
  },
};

export function analyticsSummary(range: AnalyticsRange): AnalyticsSummary {
  return {
    source: 'mock',
    range,
    rangeLabel: RANGE_LABEL[range],
    ...ANALYTICS[range],
  };
}

export function errorStatus(
  error: DealerDemoError | 'invalid_filter' | 'invalid_range'
): number {
  if (error === 'not_found') return 404;
  if (error === 'conversation_closed') return 409;
  return 400;
}

export function inboxHttp(
  url: string,
  now = new Date()
): { status: number; body: unknown } {
  const filter = new URL(url).searchParams.get('filter') ?? 'needs_reply';
  if (!isInboxFilter(filter)) {
    return { status: 400, body: { error: 'invalid_filter' } };
  }
  return {
    status: 200,
    body: { source: 'mock', filter, items: listInbox(filter, now) },
  };
}

export function conversationHttp(
  id: string,
  now = new Date()
): { status: number; body: unknown } {
  const conversation = presentConversation(id, now);
  if (!conversation) return { status: 404, body: { error: 'not_found' } };
  return { status: 200, body: { source: 'mock', conversation } };
}

export function postMessageHttp(
  id: string,
  payload: unknown,
  now = new Date()
): { status: number; body: unknown } {
  const text =
    payload &&
    typeof payload === 'object' &&
    'body' in payload &&
    typeof (payload as { body: unknown }).body === 'string'
      ? (payload as { body: string }).body
      : '';
  const result = postMessage(id, text, now);
  if (!result.ok) {
    return { status: errorStatus(result.error), body: { error: result.error } };
  }
  return { status: 200, body: { source: 'mock', conversation: result.data } };
}

export function shareNumbersHttp(
  id: string,
  payload: unknown,
  now = new Date()
): { status: number; body: unknown } {
  if (!payload || typeof payload !== 'object') {
    return { status: 400, body: { error: 'invalid_price' } };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.statedPriceCents !== 'number') {
    return { status: 400, body: { error: 'invalid_price' } };
  }
  if (
    record.writtenOtdCents != null &&
    typeof record.writtenOtdCents !== 'number'
  ) {
    return { status: 400, body: { error: 'invalid_price' } };
  }
  if (record.note != null && typeof record.note !== 'string') {
    return { status: 400, body: { error: 'invalid_price' } };
  }
  const result = shareNumbers(
    id,
    {
      statedPriceCents: record.statedPriceCents,
      writtenOtdCents:
        typeof record.writtenOtdCents === 'number'
          ? record.writtenOtdCents
          : null,
      note: typeof record.note === 'string' ? record.note : '',
    },
    now
  );
  if (!result.ok) {
    return { status: errorStatus(result.error), body: { error: result.error } };
  }
  return { status: 200, body: { source: 'mock', conversation: result.data } };
}

export function markSoldHttp(
  id: string,
  now = new Date()
): { status: number; body: unknown } {
  const result = markSold(id, now);
  if (!result.ok) {
    return { status: errorStatus(result.error), body: { error: result.error } };
  }
  return {
    status: 200,
    body: { source: 'mock', conversation: result.data, billing: billingSnapshot(now) },
  };
}

export function billingHttp(now = new Date()): { status: number; body: unknown } {
  return { status: 200, body: billingSnapshot(now) };
}

export function analyticsHttp(url: string): { status: number; body: unknown } {
  const range = new URL(url).searchParams.get('range') ?? '7d';
  if (range !== '7d' && range !== '30d' && range !== '90d') {
    return { status: 400, body: { error: 'invalid_range' } };
  }
  return { status: 200, body: analyticsSummary(range) };
}

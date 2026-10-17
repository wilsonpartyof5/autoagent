export const MONITOR_CHANNELS = ['widget', 'lead_form', 'email', 'text', 'call'] as const;
export type MonitorChannel = (typeof MONITOR_CHANNELS)[number];

export const MONITOR_STATUSES = ['replied', 'waiting', 'no_response', 'opted_out'] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const CHANNEL_LABEL: Record<MonitorChannel, string> = {
  widget: 'Widget',
  lead_form: 'Lead form',
  email: 'Email',
  text: 'Text',
  call: 'Call',
};

export const STATUS_LABEL: Record<MonitorStatus, string> = {
  replied: 'Replied',
  waiting: 'Waiting',
  no_response: 'No response',
  opted_out: 'Opted out',
};

export type MonitorTouch = {
  channel: MonitorChannel;
  at: string;
  direction: 'outbound' | 'inbound';
  cadenceDay: number | null;
};

export type OutreachMonitorRow = {
  id: string;
  dealId: string;
  dealerId: string;
  dealerName: string;
  vehicle: string;
  shopperFirst: string;
  channels: MonitorChannel[];
  touches: MonitorTouch[];
  firstReplyChannel: MonitorChannel | null;
  firstReplyAt: string | null;
  status: MonitorStatus;
  dealerReplyText: string | null;
  cadenceDay: number | null;
  isTest: boolean;
};

export type ChannelReplyRate = {
  channel: MonitorChannel;
  attempts: number;
  replies: number;
  replyRate: number | null;
};

export type MonitorFilters = {
  q: string;
  dealer: string;
  channel: MonitorChannel | '';
  status: MonitorStatus | '';
  cadenceDay: number | null;
  firstReply: MonitorChannel | '';
  traffic: 'live' | 'test' | 'all';
};

export type OutreachMonitorView = {
  source: 'live' | 'demo';
  partial: boolean;
  filters: MonitorFilters;
  dealers: Array<{ id: string; name: string }>;
  cadenceDays: number[];
  rows: OutreachMonitorRow[];
  total: number;
  replyRates: ChannelReplyRate[];
};

export type LiveMonitorSources = {
  widgetChatAttempts: Record<string, unknown>[] | null;
  outreachEvents: Record<string, unknown>[] | null;
  outreachMessages: Record<string, unknown>[] | null;
  brainVendorEvents?: Record<string, unknown>[] | null;
  failed: boolean;
};

const SOURCE_RANK = {
  widget_chat_attempts: 0,
  outreach_events: 1,
  shopper_outreach_messages: 2,
  brain_vendor_events: 3,
} as const;

type SourceName = keyof typeof SOURCE_RANK;

const CHANNEL_TIME_KEYS: Record<MonitorChannel, string[]> = {
  widget: ['widget_at', 'widget_sent_at'],
  lead_form: ['lead_form_at', 'lead_at'],
  email: ['email_at', 'email_sent_at'],
  text: ['text_at', 'sms_at', 'text_sent_at'],
  call: ['call_at', 'voice_at', 'call_sent_at'],
};

type ExplicitReply = {
  channel: MonitorChannel;
  rank: number;
  cadenceDay: number | null;
  replyText: string | null;
  at: string | null;
};

type Draft = {
  id: string;
  dealId: string;
  dealerId: string;
  dealerName: string;
  vehicle: string;
  shopperFirst: string;
  touches: MonitorTouch[];
  explicit: ExplicitReply | null;
  replyText: string | null;
  status: MonitorStatus | null;
  statusRank: number;
  optOut: boolean;
  isTest: boolean;
};

export function emptyMonitorFilters(): MonitorFilters {
  return { q: '', dealer: '', channel: '', status: '', cadenceDay: null, firstReply: '', traffic: 'live' };
}

export function normalizeChannel(value: unknown): MonitorChannel | null {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return null;
  if (raw === 'widget' || raw === 'chat' || raw === 'widget_chat') return 'widget';
  if (raw === 'lead_form' || raw === 'leadform' || raw === 'form' || raw === 'web_form') return 'lead_form';
  if (raw === 'email') return 'email';
  if (raw === 'text' || raw === 'sms' || raw === 'texts') return 'text';
  if (raw === 'call' || raw === 'voice' || raw === 'phone' || raw === 'voicemail') return 'call';
  return null;
}

export function normalizeStatus(value: unknown): MonitorStatus | null {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return null;
  if (raw === 'replied' || raw === 'reply' || raw === 'responded') return 'replied';
  if (raw === 'waiting' || raw === 'in_progress' || raw === 'sent' || raw === 'queued' || raw === 'open' || raw === 'pending') return 'waiting';
  if (raw === 'no_response' || raw === 'ended_no_response' || raw === 'noresponse') return 'no_response';
  if (raw === 'opted_out' || raw === 'opt_out' || raw === 'optout' || raw === 'unsubscribed') return 'opted_out';
  return null;
}

export function parseMonitorFilters(params: {
  q?: string;
  dealer?: string;
  channel?: string;
  status?: string;
  day?: string;
  first?: string;
  traffic?: string;
}): MonitorFilters {
  const day = params.day?.trim() ?? '';
  const traffic = params.traffic === 'test' || params.traffic === 'all' ? params.traffic : 'live';
  return {
    q: params.q?.trim() ?? '',
    dealer: params.dealer?.trim() ?? '',
    channel: normalizeChannel(params.channel) ?? '',
    status: normalizeStatus(params.status) ?? '',
    cadenceDay: /^\d+$/.test(day) ? Number(day) : null,
    firstReply: normalizeChannel(params.first) ?? '',
    traffic,
  };
}

export function replyRatesByChannel(rows: OutreachMonitorRow[]): ChannelReplyRate[] {
  return MONITOR_CHANNELS.map((channel) => {
    const attempts = rows.filter((row) => row.channels.includes(channel)).length;
    const replies = rows.filter((row) => row.firstReplyChannel === channel && row.channels.includes(channel)).length;
    return {
      channel,
      attempts,
      replies,
      replyRate: attempts === 0 ? null : replies / attempts,
    };
  });
}

export function filterMonitorRows(rows: OutreachMonitorRow[], filters: MonitorFilters): OutreachMonitorRow[] {
  const needle = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.dealer && row.dealerId !== filters.dealer && row.dealerName !== filters.dealer) return false;
    if (filters.channel && !row.channels.includes(filters.channel)) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.cadenceDay != null && row.cadenceDay !== filters.cadenceDay) return false;
    if (filters.firstReply && row.firstReplyChannel !== filters.firstReply) return false;
    if (filters.traffic === 'live' && row.isTest) return false;
    if (filters.traffic === 'test' && !row.isTest) return false;
    if (!needle) return true;
    return [row.dealerName, row.dealId, row.vehicle, row.shopperFirst, row.dealerReplyText ?? '']
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}

export function presentMonitor(
  rows: OutreachMonitorRow[],
  source: 'live' | 'demo',
  partial: boolean,
  filters: MonitorFilters,
): OutreachMonitorView {
  const dealers = uniqueDealers(rows);
  const cadenceDays = [...new Set(rows.map((row) => row.cadenceDay).filter((day): day is number => day != null))].sort((a, b) => a - b);
  const visible = filterMonitorRows(rows, filters);
  const rated = filterMonitorRows(rows, { ...filters, traffic: 'live' });
  return {
    source,
    partial,
    filters,
    dealers,
    cadenceDays,
    rows: visible,
    total: rows.filter((row) => !row.isTest).length,
    replyRates: replyRatesByChannel(rated),
  };
}

/**
 * Build monitor rows from whatever live tables returned.
 * `null` on a source means that table is missing. An empty array means the
 * table exists and has no rows. Both cases, with no rows anywhere, return
 * null so the caller can show the demo book.
 */
export function assembleLiveMonitor(sources: LiveMonitorSources): { rows: OutreachMonitorRow[]; partial: boolean } | null {
  const brain = sources.brainVendorEvents === undefined ? [] : sources.brainVendorEvents;
  const buckets = [sources.widgetChatAttempts, sources.outreachEvents, sources.outreachMessages, brain];
  const anyRows = buckets.some((rows) => rows != null && rows.length > 0);
  if (!anyRows) return null;

  const drafts = new Map<string, Draft>();
  absorbAll(drafts, sources.widgetChatAttempts ?? [], 'widget_chat_attempts');
  absorbAll(drafts, sources.outreachEvents ?? [], 'outreach_events');
  absorbAll(drafts, sources.outreachMessages ?? [], 'shopper_outreach_messages');
  absorbAll(drafts, brain ?? [], 'brain_vendor_events');

  const rows = [...drafts.values()].map(finalize).sort((a, b) => (
    a.dealerName.localeCompare(b.dealerName) || a.dealId.localeCompare(b.dealId)
  ));
  const partial = sources.failed || buckets.some((bucket) => bucket == null);
  return { rows, partial };
}

export function demoMonitorRows(): OutreachMonitorRow[] {
  return DEMO.map((row) => ({
    ...row,
    channels: [...row.channels],
    touches: row.touches.map((touch) => ({ ...touch })),
  }));
}

function absorbAll(drafts: Map<string, Draft>, rows: Record<string, unknown>[], source: SourceName): void {
  for (const row of rows) absorb(drafts, row, source);
}

function absorb(drafts: Map<string, Draft>, row: Record<string, unknown>, source: SourceName): void {
  if (source === 'brain_vendor_events' && !visibleBrainEvent(row)) return;
  const dealId = text(row, ['deal_id', 'shopper_deal_id', 'dealId']);
  if (!dealId) return;
  const dealerId = text(row, ['dealer_id', 'dealerId']) ?? '';
  const dealerName = text(row, ['dealer_name', 'dealerName', 'dealer']) ?? '';
  const dealerKey = dealerId || dealerName.toLowerCase() || 'unknown';
  const id = `${dealId}::${dealerKey}`;
  const draft = drafts.get(id) ?? {
    id,
    dealId,
    dealerId,
    dealerName,
    vehicle: '',
    shopperFirst: '',
    touches: [],
    explicit: null,
    replyText: null,
    status: null,
    statusRank: Number.POSITIVE_INFINITY,
    optOut: false,
    isTest: false,
  };
  drafts.set(id, draft);

  if (!draft.dealerId && dealerId) draft.dealerId = dealerId;
  if (!draft.dealerName && dealerName) draft.dealerName = dealerName;
  const vehicle = text(row, ['vehicle', 'vehicle_label', 'vehicle_id']);
  const shopper = text(row, ['shopper_first', 'shopper_name', 'shopper']);
  if (!draft.vehicle && vehicle) draft.vehicle = vehicle;
  if (!draft.shopperFirst && shopper) draft.shopperFirst = shopper.split(' ')[0] ?? shopper;

  const cadenceDay = cadenceFrom(row);
  const at = text(row, ['sent_at', 'occurred_at', 'created_at', 'timestamp']);
  const direction = directionFrom(row.direction);
  const channel = normalizeChannel(row.channel);
  if (channel && at) draft.touches.push({ channel, at, direction, cadenceDay });

  for (const monitorChannel of MONITOR_CHANNELS) {
    const stamp = text(row, CHANNEL_TIME_KEYS[monitorChannel]);
    if (!stamp) continue;
    draft.touches.push({ channel: monitorChannel, at: stamp, direction: 'outbound', cadenceDay });
  }

  const listed = channelList(row.channels ?? row.channels_used);
  if (listed.length > 0 && at) {
    for (const listedChannel of listed) {
      const already = draft.touches.some((touch) => touch.channel === listedChannel);
      if (!already) draft.touches.push({ channel: listedChannel, at, direction: 'outbound', cadenceDay });
    }
  }

  const explicitChannel = normalizeChannel(row.first_reply_channel);
  if (explicitChannel) {
    const rank = SOURCE_RANK[source];
    const replyText = text(row, ['dealer_reply_text', 'reply_text', 'reply_body']);
    const replyAt = text(row, ['reply_at', 'replied_at', 'first_reply_at']) ?? (direction === 'inbound' ? at : null);
    if (!draft.explicit || rank < draft.explicit.rank) {
      draft.explicit = { channel: explicitChannel, rank, cadenceDay, replyText, at: replyAt };
    }
  }

  if (direction === 'inbound') {
    const body = text(row, ['body', 'dealer_reply_text', 'reply_text', 'transcript']);
    if (body && !draft.replyText) draft.replyText = body;
  }

  const status = normalizeStatus(row.status ?? row.end_state);
  const rank = SOURCE_RANK[source];
  if (status && rank < draft.statusRank) {
    draft.status = status;
    draft.statusRank = rank;
  }

  if (row.opt_out === true || row.opted_out === true) draft.optOut = true;
  if (row.is_test === true || row.conversation_type === 'ai_to_ai_test') draft.isTest = true;
}

function visibleBrainEvent(row: Record<string, unknown>): boolean {
  const channel = normalizeChannel(row.channel);
  if (!channel || (channel !== 'email' && channel !== 'text' && channel !== 'call')) return false;
  const body = text(row, ['body', 'transcript', 'summary']);
  const recording = text(row, ['recording_path']);
  const eventType = text(row, ['event_type']) ?? '';
  if (channel === 'email' || channel === 'text') return Boolean(body);
  return Boolean(body || recording || /hangup|conversation\.ended|recording\.saved|analyzed|insights/.test(eventType));
}

function finalize(draft: Draft): OutreachMonitorRow {
  const touches = dedupeTouches(draft.touches).sort((a, b) => a.at.localeCompare(b.at) || a.channel.localeCompare(b.channel));
  const used = new Set(touches.map((touch) => touch.channel));
  let firstReplyChannel = draft.explicit?.channel ?? null;
  const inbound = touches.filter((touch) => touch.direction === 'inbound');
  if (!firstReplyChannel) firstReplyChannel = inbound[0]?.channel ?? null;
  if (firstReplyChannel) used.add(firstReplyChannel);
  const channels = MONITOR_CHANNELS.filter((channel) => used.has(channel));

  const matchingInbound = inbound.find((touch) => touch.channel === firstReplyChannel) ?? inbound[0] ?? null;
  const dealerReplyText = draft.explicit?.replyText ?? draft.replyText ?? null;
  const firstReplyAt = draft.explicit?.at ?? matchingInbound?.at ?? null;

  let cadenceDay = draft.explicit?.cadenceDay ?? null;
  if (cadenceDay == null && matchingInbound?.cadenceDay != null) cadenceDay = matchingInbound.cadenceDay;
  if (cadenceDay == null) {
    const outboundDays = touches
      .filter((touch) => touch.direction === 'outbound' && touch.cadenceDay != null)
      .map((touch) => touch.cadenceDay as number);
    cadenceDay = outboundDays.length > 0 ? Math.max(...outboundDays) : null;
  }

  let status = draft.status;
  if (draft.optOut || (dealerReplyText != null && /^stop$/i.test(dealerReplyText.trim()))) status = 'opted_out';
  else if (!status && firstReplyChannel) status = 'replied';
  else if (!status && (cadenceDay ?? 0) >= 5) status = 'no_response';
  else if (!status) status = 'waiting';

  return {
    id: draft.id,
    dealId: draft.dealId,
    dealerId: draft.dealerId || draft.dealerName || 'unknown',
    dealerName: draft.dealerName || draft.dealerId || 'Unknown dealer',
    vehicle: draft.vehicle || draft.dealId,
    shopperFirst: draft.shopperFirst,
    channels,
    touches,
    firstReplyChannel,
    firstReplyAt: firstReplyChannel ? firstReplyAt : null,
    status,
    dealerReplyText,
    cadenceDay,
    isTest: draft.isTest,
  };
}

function dedupeTouches(touches: MonitorTouch[]): MonitorTouch[] {
  const seen = new Set<string>();
  const unique: MonitorTouch[] = [];
  for (const touch of touches) {
    const key = `${touch.channel}|${touch.at}|${touch.direction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(touch);
  }
  return unique;
}

function uniqueDealers(rows: OutreachMonitorRow[]): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.dealerId, row.dealerName);
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function text(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function cadenceFrom(row: Record<string, unknown>): number | null {
  for (const key of ['cadence_day', 'cadenceDay']) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  }
  const touchpoint = text(row, ['touchpoint']);
  if (!touchpoint) return null;
  const match = /^D(\d+)/.exec(touchpoint);
  if (match) return Number(match[1]);
  if (touchpoint === 'VM-1') return 0;
  return null;
}

function directionFrom(value: unknown): 'outbound' | 'inbound' {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'inbound' || raw === 'in' || raw === 'reply') return 'inbound';
  return 'outbound';
}

function channelList(value: unknown): MonitorChannel[] {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const channels: MonitorChannel[] = [];
  for (const part of parts) {
    const channel = normalizeChannel(part);
    if (channel && !channels.includes(channel)) channels.push(channel);
  }
  return channels;
}

function touch(
  channel: MonitorChannel,
  at: string,
  direction: 'outbound' | 'inbound',
  cadenceDay: number,
): MonitorTouch {
  return { channel, at, direction, cadenceDay };
}

const DEMO: OutreachMonitorRow[] = [
  row({
    id: 'mon-001',
    dealId: 'deal-rav4-maya',
    dealerId: 'dlr-piedmont',
    dealerName: 'Piedmont Auto Group',
    vehicle: '2024 Toyota RAV4 Hybrid XLE',
    shopperFirst: 'Maya',
    channels: ['widget'],
    touches: [
      touch('widget', '2026-09-20T15:00:00.000Z', 'outbound', 0),
      touch('widget', '2026-09-20T15:18:00.000Z', 'inbound', 0),
    ],
    firstReplyChannel: 'widget',
    firstReplyAt: '2026-09-20T15:18:00.000Z',
    status: 'replied',
    dealerReplyText: 'Happy to price it on the site chat. Out the door is $34,200 with doc fee and tax listed.',
    cadenceDay: 0,
  }),
  row({
    id: 'mon-002',
    dealId: 'deal-crv-chris',
    dealerId: 'dlr-piedmont',
    dealerName: 'Piedmont Auto Group',
    vehicle: '2024 Honda CR-V EX',
    shopperFirst: 'Chris',
    channels: ['lead_form', 'email'],
    touches: [
      touch('lead_form', '2026-09-21T14:00:00.000Z', 'outbound', 0),
      touch('email', '2026-09-21T14:05:00.000Z', 'outbound', 0),
      touch('lead_form', '2026-09-21T16:40:00.000Z', 'inbound', 0),
    ],
    firstReplyChannel: 'lead_form',
    firstReplyAt: '2026-09-21T16:40:00.000Z',
    status: 'replied',
    dealerReplyText: 'Got the lead form. Selling price $31,400, doc fee $499, tax and title still being written up.',
    cadenceDay: 0,
  }),
  row({
    id: 'mon-003',
    dealId: 'deal-f150-elena',
    dealerId: 'dlr-catawba',
    dealerName: 'Catawba Motor Co',
    vehicle: '2022 Ford F-150 XLT',
    shopperFirst: 'Elena',
    channels: ['email', 'text'],
    touches: [
      touch('email', '2026-09-18T15:00:00.000Z', 'outbound', 0),
      touch('text', '2026-09-19T15:10:00.000Z', 'outbound', 1),
      touch('text', '2026-09-19T18:02:00.000Z', 'inbound', 1),
    ],
    firstReplyChannel: 'text',
    firstReplyAt: '2026-09-19T18:02:00.000Z',
    status: 'replied',
    dealerReplyText: 'We can do $39,800 out the door if they are paying cash. I will email the fee lines.',
    cadenceDay: 1,
  }),
  row({
    id: 'mon-004',
    dealId: 'deal-tucson-sam',
    dealerId: 'dlr-york',
    dealerName: 'York Road Motors',
    vehicle: '2025 Hyundai Tucson SEL',
    shopperFirst: 'Sam',
    channels: ['email', 'call'],
    touches: [
      touch('email', '2026-09-18T15:20:00.000Z', 'outbound', 0),
      touch('call', '2026-09-19T16:00:00.000Z', 'outbound', 1),
      touch('call', '2026-09-19T16:22:00.000Z', 'inbound', 1),
    ],
    firstReplyChannel: 'call',
    firstReplyAt: '2026-09-19T16:22:00.000Z',
    status: 'replied',
    dealerReplyText: 'Called back. Out the door $31,050. Paint protection came off the quote.',
    cadenceDay: 1,
  }),
  row({
    id: 'mon-005',
    dealId: 'deal-camry-jordan',
    dealerId: 'dlr-york',
    dealerName: 'York Road Motors',
    vehicle: '2023 Toyota Camry SE',
    shopperFirst: 'Jordan',
    channels: ['widget', 'email'],
    touches: [
      touch('widget', '2026-09-22T15:00:00.000Z', 'outbound', 0),
      touch('email', '2026-09-25T15:00:00.000Z', 'outbound', 3),
    ],
    firstReplyChannel: null,
    firstReplyAt: null,
    status: 'waiting',
    dealerReplyText: null,
    cadenceDay: 3,
  }),
  row({
    id: 'mon-006',
    dealId: 'deal-accord-avery',
    dealerId: 'dlr-wylie',
    dealerName: 'Lake Wylie Cars',
    vehicle: '2024 Honda Accord Sport',
    shopperFirst: 'Avery',
    channels: ['lead_form', 'email', 'text'],
    touches: [
      touch('lead_form', '2026-09-20T13:00:00.000Z', 'outbound', 0),
      touch('email', '2026-09-20T13:04:00.000Z', 'outbound', 0),
      touch('email', '2026-09-20T19:12:00.000Z', 'inbound', 0),
      touch('text', '2026-09-21T15:00:00.000Z', 'outbound', 1),
    ],
    firstReplyChannel: 'email',
    firstReplyAt: '2026-09-20T19:12:00.000Z',
    status: 'replied',
    dealerReplyText: 'Emailing the itemized out-the-door total: $32,480 including tax. Nitrogen fee removed.',
    cadenceDay: 0,
  }),
  row({
    id: 'mon-007',
    dealId: 'deal-equinox-priya',
    dealerId: 'dlr-palmetto',
    dealerName: 'Palmetto Honda',
    vehicle: '2024 Chevrolet Equinox LT',
    shopperFirst: 'Priya',
    channels: ['email', 'text', 'call'],
    touches: [
      touch('email', '2026-09-12T15:00:00.000Z', 'outbound', 0),
      touch('text', '2026-09-13T15:00:00.000Z', 'outbound', 1),
      touch('call', '2026-09-17T15:00:00.000Z', 'outbound', 5),
    ],
    firstReplyChannel: null,
    firstReplyAt: null,
    status: 'no_response',
    dealerReplyText: null,
    cadenceDay: 5,
  }),
  row({
    id: 'mon-008',
    dealId: 'deal-rav4-riley',
    dealerId: 'dlr-ridge',
    dealerName: 'Blue Ridge Motors',
    vehicle: '2024 Toyota RAV4 Hybrid XLE',
    shopperFirst: 'Riley',
    channels: ['text', 'call'],
    touches: [
      touch('text', '2026-09-18T15:30:00.000Z', 'outbound', 0),
      touch('call', '2026-09-20T16:10:00.000Z', 'outbound', 2),
      touch('call', '2026-09-20T16:40:00.000Z', 'inbound', 2),
    ],
    firstReplyChannel: 'call',
    firstReplyAt: '2026-09-20T16:40:00.000Z',
    status: 'replied',
    dealerReplyText: 'Manager called. Best out-the-door number today is $33,900.',
    cadenceDay: 2,
  }),
  row({
    id: 'mon-009',
    dealId: 'deal-crv-noah',
    dealerId: 'dlr-queen',
    dealerName: 'Queen City Chevrolet',
    vehicle: '2024 Honda CR-V EX',
    shopperFirst: 'Noah',
    channels: ['widget'],
    touches: [
      touch('widget', '2026-09-23T14:12:00.000Z', 'outbound', 0),
      touch('widget', '2026-09-23T14:20:00.000Z', 'inbound', 0),
    ],
    firstReplyChannel: 'widget',
    firstReplyAt: '2026-09-23T14:20:00.000Z',
    status: 'opted_out',
    dealerReplyText: 'STOP',
    cadenceDay: 0,
  }),
  row({
    id: 'mon-010',
    dealId: 'deal-f150-sofia',
    dealerId: 'dlr-lowcountry',
    dealerName: 'Lowcountry Auto',
    vehicle: '2022 Ford F-150 XLT',
    shopperFirst: 'Sofia',
    channels: ['email', 'lead_form'],
    touches: [
      touch('lead_form', '2026-09-24T15:00:00.000Z', 'outbound', 0),
      touch('email', '2026-09-25T15:00:00.000Z', 'outbound', 1),
    ],
    firstReplyChannel: null,
    firstReplyAt: null,
    status: 'waiting',
    dealerReplyText: null,
    cadenceDay: 1,
  }),
  row({
    id: 'mon-011',
    dealId: 'deal-tucson-harper',
    dealerId: 'dlr-catawba',
    dealerName: 'Catawba Motor Co',
    vehicle: '2025 Hyundai Tucson SEL',
    shopperFirst: 'Harper',
    channels: ['call', 'email'],
    touches: [
      touch('email', '2026-09-16T15:00:00.000Z', 'outbound', 0),
      touch('call', '2026-09-18T15:00:00.000Z', 'outbound', 2),
      touch('email', '2026-09-20T15:30:00.000Z', 'inbound', 4),
    ],
    firstReplyChannel: 'email',
    firstReplyAt: '2026-09-20T15:30:00.000Z',
    status: 'replied',
    dealerReplyText: 'Sorry for the delay. Out the door $30,640. Market adjustment is off the sheet.',
    cadenceDay: 4,
  }),
  row({
    id: 'mon-012',
    dealId: 'deal-accord-liam',
    dealerId: 'dlr-palmetto',
    dealerName: 'Palmetto Honda',
    vehicle: '2024 Honda Accord Sport',
    shopperFirst: 'Liam',
    channels: ['text'],
    touches: [touch('text', '2026-09-26T15:05:00.000Z', 'outbound', 0)],
    firstReplyChannel: null,
    firstReplyAt: null,
    status: 'waiting',
    dealerReplyText: null,
    cadenceDay: 0,
  }),
];

function row(value: Omit<OutreachMonitorRow, 'isTest'> & { isTest?: boolean }): OutreachMonitorRow {
  return { isTest: false, ...value };
}

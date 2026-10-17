/**
 * Telnyx webhook signature verification using Ed25519.
 * See: https://developers.telnyx.com/docs/messaging/webhooks#webhook-signature-validation
 */

import { createPublicKey, verify } from 'crypto';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

export type TelnyxSignatureResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Verify Telnyx webhook signature using Ed25519.
 * The public key should be the base64-encoded public key from the Telnyx portal.
 */
export function verifyTelnyxSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyBase64: string | null,
): TelnyxSignatureResult {
  if (!publicKeyBase64) {
    return { valid: false, reason: 'TELNYX_PUBLIC_KEY not configured' };
  }
  if (!signature) {
    return { valid: false, reason: 'Missing telnyx-signature-ed25519 header' };
  }
  if (!timestamp) {
    return { valid: false, reason: 'Missing telnyx-timestamp header' };
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  const now = Date.now();
  if (Math.abs(now - timestampMs) > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, reason: 'Timestamp outside tolerance window' };
  }

  try {
    const signedPayload = `${timestamp}|${payload}`;
    const signatureBuffer = Buffer.from(signature, 'base64');
    const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');

    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: 'der',
      type: 'spki',
    });

    const verified = verify(null, Buffer.from(signedPayload), publicKey, signatureBuffer);
    if (!verified) {
      return { valid: false, reason: 'Signature verification failed' };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, reason: `Signature verification error: ${message}` };
  }
}

export type TelnyxEventType =
  | 'call.initiated'
  | 'call.answered'
  | 'call.hangup'
  | 'call.machine.detection.ended'
  | 'call.recording.saved'
  | 'message.sent'
  | 'message.finalized'
  | 'message.received'
  | 'email.delivered'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'
  | 'email.spam_reported'
  | 'email.unsubscribed'
  | 'email.received';

export type TelnyxCallPayload = {
  data: {
    id: string;
    event_type: TelnyxEventType;
    occurred_at: string;
    record_type: 'event';
    payload: {
      call_control_id?: string;
      call_leg_id?: string;
      call_session_id?: string;
      client_state?: string;
      connection_id?: string;
      direction?: 'inbound' | 'outbound';
      from?: string;
      to?: string;
      hangup_cause?: string;
      hangup_source?: string;
      start_time?: string;
      end_time?: string;
      recording_urls?: { mp3?: string; wav?: string };
    };
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
};

export type TelnyxMessagingPayload = {
  data: {
    id: string;
    event_type: TelnyxEventType;
    occurred_at: string;
    record_type: 'event';
    payload: {
      id: string;
      type: 'SMS' | 'MMS';
      direction: 'inbound' | 'outbound';
      from: { phone_number: string };
      to: Array<{ phone_number: string; status: string }>;
      text?: string;
      errors?: Array<{ code: string; title: string; detail?: string }>;
      completed_at?: string;
      parts?: number;
    };
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
};

export type TelnyxEmailPayload = {
  data: {
    id: string;
    event_type: TelnyxEventType;
    occurred_at: string;
    record_type: 'event';
    payload: {
      id: string;
      direction: 'inbound' | 'outbound';
      from?: string;
      to?: string[];
      cc?: string[];
      subject?: string;
      body?: { plain?: string; html?: string };
      client_state?: string;
      status?: string;
      bounce_type?: string;
      bounce_reason?: string;
      errors?: Array<{ code: string; title: string; detail?: string }>;
    };
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
};

export type TelnyxPayload = TelnyxCallPayload | TelnyxMessagingPayload | TelnyxEmailPayload;

export type TelnyxClientState = {
  dealId?: string;
  dealerId?: string;
  touchpoint?: string;
  variant?: string;
  conversationId?: string;
};

export type CallLink = {
  dealId: string;
  dealerId: string;
  touchpointId: string;
  variant?: string;
  conversationId?: string;
};

/** Seeded in 20261018190000_communications_and_test_labels.sql. */
export const SEEDED_LABELED_NUMBERS = [
  { phoneE164: '+18039878296', label: 'test agent 1', kind: 'test', role: 'drevvy_caller' },
  { phoneE164: '+18392748197', label: 'test agent 2', kind: 'test', role: 'dealer' },
] as const;

export function seededTestNumbers(): Set<string> {
  return new Set(SEEDED_LABELED_NUMBERS.filter((row) => row.kind === 'test').map((row) => row.phoneE164));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseClientState(base64: string | undefined): TelnyxClientState {
  if (!base64) return {};
  try {
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const dealId = asString(parsed.dealId) ?? asString(parsed.deal_id);
    const dealerId = asString(parsed.dealerId) ?? asString(parsed.dealer_id);
    const touchpoint = asString(parsed.touchpoint) ?? asString(parsed.touchpointId) ?? asString(parsed.touchpoint_id);
    const variant = asString(parsed.variant);
    const conversationId = asString(parsed.conversationId) ?? asString(parsed.conversation_id);
    const result: TelnyxClientState = {};
    if (dealId) result.dealId = dealId;
    if (dealerId) result.dealerId = dealerId;
    if (touchpoint) result.touchpoint = touchpoint;
    if (variant) result.variant = variant;
    if (conversationId) result.conversationId = conversationId;
    return result;
  } catch {
    return {};
  }
}

export function encodeClientState(link: CallLink): string {
  const payload = {
    deal_id: link.dealId,
    dealer_id: link.dealerId,
    touchpoint_id: link.touchpointId,
    dealId: link.dealId,
    dealerId: link.dealerId,
    touchpoint: link.touchpointId,
    ...(link.variant ? { variant: link.variant } : {}),
    ...(link.conversationId ? { conversation_id: link.conversationId, conversationId: link.conversationId } : {}),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function telnyxStatusCallbackUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.TELNYX_WEBHOOK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const configured = env.NEXT_PUBLIC_APP_URL?.trim() || env.APP_URL?.trim();
  const vercel = env.VERCEL_URL?.trim();
  const base = configured || (vercel ? `https://${vercel}` : '');
  if (!base) return '';
  const origin = base.startsWith('http') ? base : `https://${base}`;
  return `${origin.replace(/\/$/, '')}/api/webhooks/telnyx`;
}

const AI_STATUS_EVENTS = 'initiated ringing answered completed no-answer busy canceled failed analyzed';

export function buildTexmlAiCallBody(input: {
  from: string;
  to: string;
  assistantId: string;
  webhookUrl: string;
  link: CallLink;
}): Record<string, unknown> {
  return {
    From: input.from,
    To: input.to,
    AIAssistantId: input.assistantId,
    ClientState: encodeClientState(input.link),
    StatusCallback: input.webhookUrl,
    StatusCallbackMethod: 'POST',
    StatusCallbackEvent: AI_STATUS_EVENTS,
    ConversationCallback: input.webhookUrl,
    ConversationCallbackMethod: 'POST',
    RecordingStatusCallback: input.webhookUrl,
    RecordingStatusCallbackMethod: 'POST',
    RecordingStatusCallbackEvent: 'completed',
    Record: true,
    RecordingChannels: 'dual',
    RecordingTrack: 'both',
    SendRecordingUrl: true,
  };
}

export function buildOutboundCallBody(input: {
  connectionId: string;
  from: string;
  to: string;
  webhookUrl: string;
  link: CallLink;
}): Record<string, unknown> {
  return {
    connection_id: input.connectionId,
    from: input.from,
    to: input.to,
    webhook_url: input.webhookUrl,
    webhook_url_method: 'POST',
    client_state: encodeClientState(input.link),
    record: 'record-from-answer',
    record_channels: 'dual',
    record_format: 'mp3',
    record_track: 'both',
  };
}

export function buildOutboundEmailBody(input: {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  webhookUrl: string;
  link?: CallLink;
}): Record<string, unknown> {
  return {
    from: input.from,
    reply_to: input.replyTo,
    to: [{ email: input.to }],
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    webhook_url: input.webhookUrl,
    webhook_url_method: 'POST',
    ...(input.link ? { client_state: encodeClientState(input.link) } : {}),
  };
}

export function buildOutboundSmsBody(input: {
  from: string;
  to: string;
  text: string;
  webhookUrl: string;
}): Record<string, unknown> {
  return {
    from: input.from,
    to: input.to,
    text: input.text,
    webhook_url: input.webhookUrl,
    webhook_url_method: 'POST',
    use_profile_webhooks: false,
  };
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('@')) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function phoneList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => normalizePhone(part))
    .filter((phone): phone is string => Boolean(phone));
}

export function flagTestParties(
  from: string | null,
  to: string | null,
  testNumbers: Set<string>,
): { isTest: boolean; conversationType: 'ai_to_ai_test' | null } {
  const fromPhones = phoneList(from);
  const toPhones = phoneList(to);
  if (fromPhones.length === 0 || toPhones.length === 0) return { isTest: false, conversationType: null };
  const bothTest = [...fromPhones, ...toPhones].every((phone) => testNumbers.has(phone));
  return bothTest
    ? { isTest: true, conversationType: 'ai_to_ai_test' }
    : { isTest: false, conversationType: null };
}

export type StructuredCallResult = {
  textableNumber: string | null;
  email: string | null;
  goalReached: boolean;
  voicemailLeft: boolean;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function parseStructuredCallResult(input: {
  texts?: Array<string | null | undefined>;
  toolCalls?: Array<{ name?: string; arguments?: string }>;
  machine?: string | null;
}): StructuredCallResult {
  const chunks = (input.texts ?? []).filter((text): text is string => Boolean(text && text.trim()));
  for (const call of input.toolCalls ?? []) {
    if (call.name) chunks.push(call.name);
    if (call.arguments) chunks.push(call.arguments);
  }
  const text = chunks.join('\n');
  const email = labeledEmail(text) ?? text.match(EMAIL_RE)?.[0] ?? null;
  return {
    textableNumber: labeledPhone(text),
    email: email ? email.toLowerCase() : null,
    goalReached: goalReached(text),
    voicemailLeft: voicemailLeft(text, input.machine ?? null),
  };
}

function labeledEmail(text: string): string | null {
  const match = text.match(/(?:e-?mail(?: address)?|email_captured)\s*(?:is|=|:)?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match?.[1] ?? null;
}

function labeledPhone(text: string): string | null {
  const match = text.match(/(?:textable(?:\s+number)?|text(?:\s+me)?(?:\s+at)?|sms(?:\s+number)?|mobile|cell)\s*(?:is|=|:)?\s*(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i);
  const raw = match?.[1] ?? jsonString(text, 'textable_number') ?? jsonString(text, 'textableNumber');
  return raw ? normalizePhone(raw) : null;
}

function jsonString(text: string, key: string): string | null {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'));
  return match?.[1] ?? null;
}

function goalReached(text: string): boolean {
  if (/"goal_reached"\s*:\s*false/i.test(text)) return false;
  if (/\b(goal not reached|did not reach(?: the)? goal|goal was not reached)\b/i.test(text)) return false;
  if (/"goal_reached"\s*:\s*true/i.test(text)) return true;
  return /\bgoal[\s_-]*reached\b/i.test(text);
}

function voicemailLeft(text: string, machine: string | null): boolean {
  if (/"voicemail_left"\s*:\s*false/i.test(text)) return false;
  if (/"voicemail_left"\s*:\s*true/i.test(text)) return true;
  if (/\b(left (?:a )?voicemail|voicemail left)\b/i.test(text)) return true;
  const amd = (machine ?? '').toLowerCase();
  if (!amd || amd.includes('human') || amd.includes('not_sure')) return false;
  return amd.includes('machine') || amd.includes('voicemail') || amd === 'fax';
}

export function formatConversationMessages(
  messages: Array<{ role?: string; text?: string; content?: string }>,
): string {
  return messages
    .map((message) => {
      const role = (message.role || 'unknown').trim();
      const text = (message.text ?? message.content ?? '').trim();
      if (!text) return '';
      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

export function shouldFetchTranscript(eventType: string): boolean {
  return eventType === 'call.hangup'
    || eventType === 'call.conversation.ended'
    || eventType === 'call.recording.saved'
    || eventType === 'call.analyzed'
    || eventType === 'call.conversation_insights.generated'
    || eventType === 'conversation_ended';
}

export function shouldDownloadRecording(eventType: string): boolean {
  return eventType === 'call.recording.saved' || eventType === 'call.analyzed';
}

export function recordingObjectPath(callControlId: string | null, recordingId: string | null): string {
  const raw = recordingId || callControlId || 'recording';
  const safe = raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180);
  return `calls/${safe}.mp3`;
}

export function safeRecordingPath(path: string): string | null {
  if (!/^calls\/[A-Za-z0-9._-]{1,180}\.mp3$/.test(path)) return null;
  if (path.includes('..')) return null;
  return path;
}

export function isSafeRecordingUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host === 'metadata.google.internal') {
    return false;
  }
  if (host === '0.0.0.0' || host === '::1') return false;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return false;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }
  return true;
}

export function pickRecordingUrl(value: unknown): string | null {
  const hits: Array<{ url: string; dual: boolean }> = [];
  const visit = (node: unknown, dualHint: boolean) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, dualHint);
      return;
    }
    const record = node as Record<string, unknown>;
    const channels = typeof record.channels === 'string' ? record.channels.toLowerCase() : '';
    const dual = dualHint || channels === 'dual' || channels === 'stereo';
    for (const key of ['recording_urls', 'public_recording_urls']) {
      const urls = record[key];
      if (!urls || typeof urls !== 'object' || Array.isArray(urls)) continue;
      const mp3 = (urls as Record<string, unknown>).mp3;
      if (typeof mp3 === 'string' && mp3.startsWith('https://')) hits.push({ url: mp3, dual });
    }
    for (const child of Object.values(record)) visit(child, dual);
  };
  visit(value, false);
  const unique = hits.filter((hit) => isSafeRecordingUrl(hit.url));
  return unique.find((hit) => hit.dual)?.url ?? unique[0]?.url ?? null;
}

const REDACTED_KEYS = /^(client_state|recording_urls|public_recording_urls|recording_url|media_url|api_key|secret|authorization|password|sip_auth_password|token|sip_headers|custom_headers)$/i;

export function sanitizeTelnyxPayload(payload: unknown): Record<string, unknown> {
  const redacted = redactValue(payload);
  return redacted && typeof redacted === 'object' && !Array.isArray(redacted)
    ? redacted as Record<string, unknown>
    : {};
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? stripUrlQuery(value) : value;
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.test(key)) continue;
    out[key] = redactValue(child);
  }
  return out;
}

function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value);
    if (!url.search) return value;
    url.search = '';
    return `${url.toString()}?[redacted]`;
  } catch {
    return value;
  }
}

export type NormalizedTelnyxEvent = {
  eventType: string;
  vendorEventId: string;
  occurredAt: string;
  channel: 'call' | 'sms' | 'email' | 'voicemail' | null;
  direction: 'outbound' | 'inbound' | null;
  from: string | null;
  to: string | null;
  body: string | null;
  inlineTranscript: string | null;
  summary: string | null;
  durationS: number | null;
  clientState: TelnyxClientState;
  callControlId: string | null;
  conversationId: string | null;
  recordingId: string | null;
  recordingUrl: string | null;
  insightTexts: string[];
  toolCalls: Array<{ name: string; arguments: string }>;
  machine: string | null;
  status: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  inReplyTo: string | null;
  references: string | null;
};

export function normalizeTelnyxPayload(payload: unknown): NormalizedTelnyxEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const eventType = asString(record.event_type);
  const vendorEventId = asString(record.id);
  if (!eventType || !vendorEventId) return null;
  const occurredAt = asString(record.occurred_at) ?? new Date().toISOString();
  const inner = record.payload && typeof record.payload === 'object'
    ? record.payload as Record<string, unknown>
    : {};
  const channel = mapTelnyxEventToChannel(eventType);
  const status = mapTelnyxEventToStatus(payload as TelnyxPayload);
  const messages = readMessages(inner);
  const insightTexts = collectInsightTexts(inner);
  const summary = insightTexts[0] ?? asString(inner.summary) ?? null;
  const inlineTranscript = messages.length > 0
    ? formatConversationMessages(messages)
    : asString(inner.transcription_text) ?? null;
  const durationS = readDuration(inner);
  const machine = asString(inner.answering_machine_detection_result)
    ?? asString(inner.machine_detection_result)
    ?? asString(inner.result && typeof inner.result === 'object' ? (inner.result as Record<string, unknown>).result : undefined)
    ?? null;

  return {
    eventType,
    vendorEventId,
    occurredAt,
    channel,
    direction: readDirection(inner.direction),
    from: partyAddress(inner.from),
    to: partyAddress(inner.to),
    body: messageBody(channel, inner),
    inlineTranscript: channel === 'email' ? (inlineTranscript ?? (messageBody(channel, inner) ? stripHtml(messageBody(channel, inner) as string) : null)) : inlineTranscript,
    summary,
    durationS,
    clientState: parseClientState(asString(inner.client_state)),
    callControlId: asString(inner.call_control_id) ?? asString(inner.call_session_id) ?? asString(inner.call_sid) ?? null,
    conversationId: asString(inner.conversation_id) ?? null,
    recordingId: asString(inner.recording_id) ?? null,
    recordingUrl: pickRecordingUrl(inner),
    insightTexts,
    toolCalls: readToolCalls(inner),
    machine,
    status: status.status,
    errorCode: status.errorCode,
    errorDetail: status.errorDetail,
    inReplyTo: headerValue(inner, 'in_reply_to') ?? headerValue(inner, 'in-reply-to'),
    references: headerValue(inner, 'references'),
  };
}

function readDirection(value: unknown): 'outbound' | 'inbound' | null {
  const raw = asString(value)?.toLowerCase();
  if (raw === 'inbound' || raw === 'outbound') return raw;
  return null;
}

function headerValue(inner: Record<string, unknown>, name: string): string | null {
  const direct = asString(inner[name]);
  if (direct) return direct;
  const headers = inner.headers;
  if (Array.isArray(headers)) {
    for (const header of headers) {
      if (!header || typeof header !== 'object') continue;
      const record = header as Record<string, unknown>;
      const key = (asString(record.name) ?? asString(record.key) ?? '').toLowerCase();
      if (key === name) return asString(record.value) ?? null;
    }
  }
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
    const record = headers as Record<string, unknown>;
    return asString(record[name]) ?? asString(record[name.replace(/_/g, '-')]) ?? null;
  }
  return null;
}

function partyAddress(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const parts = value.map(partyAddress).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return partyAddress(record.phone_number ?? record.email ?? record.address ?? record.number);
  }
  return null;
}

function messageBody(channel: NormalizedTelnyxEvent['channel'], inner: Record<string, unknown>): string | null {
  if (channel === 'sms') return asString(inner.text) ?? null;
  if (channel !== 'email') return null;
  const body = inner.body && typeof inner.body === 'object' ? inner.body as Record<string, unknown> : {};
  const plain = asString(body.plain);
  const html = asString(body.html);
  const text = asString(inner.text);
  const content = plain || html || text || null;
  const subject = asString(inner.subject);
  if (subject && content) return `Subject: ${subject}\n\n${content}`;
  if (subject) return `Subject: ${subject}`;
  return content;
}

function readDuration(inner: Record<string, unknown>): number | null {
  for (const key of ['duration_sec', 'duration_seconds', 'call_duration_secs', 'duration_s']) {
    const value = inner[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value);
  }
  const start = asString(inner.start_time) ?? asString(inner.recording_started_at);
  const end = asString(inner.end_time) ?? asString(inner.recording_ended_at);
  if (start && end) {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      return Math.round((endMs - startMs) / 1000);
    }
  }
  return null;
}

function readMessages(inner: Record<string, unknown>): Array<{ role?: string; text?: string; content?: string }> {
  const messages = inner.messages;
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => message && typeof message === 'object') as Array<{ role?: string; text?: string; content?: string }>;
}

function readToolCalls(inner: Record<string, unknown>): Array<{ name: string; arguments: string }> {
  const calls: Array<{ name: string; arguments: string }> = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.tool_calls)) {
      for (const call of record.tool_calls) {
        if (!call || typeof call !== 'object') continue;
        const fn = (call as { function?: unknown }).function;
        const source = fn && typeof fn === 'object' ? fn as Record<string, unknown> : call as Record<string, unknown>;
        const name = asString(source.name) ?? '';
        const args = source.arguments;
        const serialized = typeof args === 'string' ? args : args && typeof args === 'object' ? JSON.stringify(args) : '';
        if (name || serialized) calls.push({ name, arguments: serialized });
      }
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === 'object') visit(child);
    }
  };
  visit(inner.messages);
  return calls;
}

function collectInsightTexts(inner: Record<string, unknown>): string[] {
  const texts: string[] = [];
  const visit = (node: unknown, key: string, depth: number) => {
    if (texts.length >= 20 || depth > 6 || node == null) return;
    if (typeof node === 'string') {
      if (/result|summary|insight/i.test(key) && node.trim()) texts.push(node.trim());
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key, depth + 1);
      return;
    }
    if (typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        visit(child, childKey, depth + 1);
      }
    }
  };
  visit(inner.conversation_insights, 'conversation_insights', 0);
  visit(inner.results, 'results', 0);
  visit(inner.analysis, 'analysis', 0);
  return texts;
}

const TELNYX_API = 'https://api.telnyx.com/v2';
const MAX_RECORDING_BYTES = 40 * 1024 * 1024;

export async function fetchTelnyxConversation(
  conversationId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; transcript: string; summary: string | null } | { ok: false }> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(conversationId) || !apiKey) return { ok: false };
  try {
  const messages: Array<{ role?: string; text?: string; content?: string }> = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchImpl(
      `${TELNYX_API}/ai/conversations/${conversationId}/messages?page_size=100&page_number=${page}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) return { ok: false };
    const json = await response.json() as { data?: Array<{ role?: string; text?: string; content?: string }> };
    const batch = Array.isArray(json.data) ? json.data : [];
    messages.push(...batch);
    if (batch.length < 100) break;
  }
  let summary: string | null = null;
  const insights = await fetchImpl(
    `${TELNYX_API}/ai/conversations/${conversationId}/conversations-insights`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (insights.ok) {
    const json = await insights.json() as { data?: unknown };
    const texts = collectInsightTexts({ conversation_insights: json.data });
    summary = texts[0] ?? null;
  }
  return { ok: true, transcript: formatConversationMessages(messages), summary };
  } catch {
    return { ok: false };
  }
}

export async function downloadRecordingMp3(
  url: string,
  apiKey: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array | null> {
  if (!isSafeRecordingUrl(url)) return null;
  try {
  const headers: Record<string, string> = {};
  const host = new URL(url).hostname.toLowerCase();
  if (apiKey && (host === 'api.telnyx.com' || host.endsWith('.telnyx.com'))) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const response = await fetchImpl(url, { headers, redirect: 'follow' });
  if (!response.ok) return null;
  if (response.url && !isSafeRecordingUrl(response.url)) return null;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/html') || type.includes('application/json')) return null;
  const length = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > MAX_RECORDING_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RECORDING_BYTES) return null;
  return bytes;
  } catch {
    return null;
  }
}

export async function createTexmlAiCall(
  input: {
    connectionId: string;
    from: string;
    to: string;
    assistantId: string;
    webhookUrl?: string;
    link: CallLink;
  },
  options: { apiKey: string; fetchImpl?: typeof fetch } ,
): Promise<{ callSid: string | null; clientState: string } | { error: string }> {
  const webhookUrl = input.webhookUrl || telnyxStatusCallbackUrl();
  if (!webhookUrl) return { error: 'Status callback URL is not configured' };
  const body = buildTexmlAiCallBody({ ...input, webhookUrl });
  const response = await (options.fetchImpl ?? fetch)(
    `${TELNYX_API}/texml/ai_calls/${encodeURIComponent(input.connectionId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) return { error: 'Telnyx AI call was not accepted' };
  const json = await response.json() as { call_sid?: string; data?: { call_sid?: string; call_control_id?: string } };
  return {
    callSid: json.call_sid ?? json.data?.call_sid ?? json.data?.call_control_id ?? null,
    clientState: String(body.ClientState),
  };
}

export async function createOutboundCall(
  input: {
    connectionId: string;
    from: string;
    to: string;
    webhookUrl?: string;
    link: CallLink;
  },
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<{ callControlId: string | null; clientState: string } | { error: string }> {
  const webhookUrl = input.webhookUrl || telnyxStatusCallbackUrl();
  if (!webhookUrl) return { error: 'Status callback URL is not configured' };
  const body = buildOutboundCallBody({ ...input, webhookUrl });
  const response = await (options.fetchImpl ?? fetch)(`${TELNYX_API}/calls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return { error: 'Telnyx call was not accepted' };
  const json = await response.json() as { data?: { call_control_id?: string; call_session_id?: string } };
  return {
    callControlId: json.data?.call_control_id ?? json.data?.call_session_id ?? null,
    clientState: String(body.client_state),
  };
}

export async function createOutboundEmail(
  input: {
    from: string;
    replyTo: string;
    to: string;
    subject: string;
    text: string;
    html?: string | null;
    webhookUrl?: string;
    link?: CallLink;
  },
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<{ messageId: string | null } | { error: string }> {
  const webhookUrl = input.webhookUrl || telnyxStatusCallbackUrl();
  if (!webhookUrl) return { error: 'Status callback URL is not configured' };
  const body = buildOutboundEmailBody({ ...input, webhookUrl });
  const response = await (options.fetchImpl ?? fetch)(`${TELNYX_API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return { error: 'Telnyx email was not accepted' };
  const json = await response.json() as { data?: { id?: string } };
  return { messageId: json.data?.id ?? null };
}

export async function createOutboundSms(
  input: { from: string; to: string; text: string; webhookUrl?: string },
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<{ messageId: string | null } | { error: string }> {
  const webhookUrl = input.webhookUrl || telnyxStatusCallbackUrl();
  if (!webhookUrl) return { error: 'Status callback URL is not configured' };
  const body = buildOutboundSmsBody({ ...input, webhookUrl });
  const response = await (options.fetchImpl ?? fetch)(`${TELNYX_API}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return { error: 'Telnyx message was not accepted' };
  const json = await response.json() as { data?: { id?: string } };
  return { messageId: json.data?.id ?? null };
}

export function mapTelnyxEventToChannel(eventType: string): 'call' | 'sms' | 'email' | 'voicemail' | null {
  if (eventType.startsWith('call.')) return 'call';
  if (eventType.startsWith('message.')) return 'sms';
  if (eventType.startsWith('email.')) return 'email';
  return null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapTelnyxEventToStatus(payload: TelnyxPayload): { status: string | null; errorCode: string | null; errorDetail: string | null } {
  const eventType = payload.data.event_type;
  if (eventType === 'call.hangup') {
    const hangupCause = (payload.data.payload as TelnyxCallPayload['data']['payload']).hangup_cause;
    return {
      status: hangupCause === 'normal_clearing' ? 'completed' : hangupCause ?? 'hangup',
      errorCode: hangupCause !== 'normal_clearing' ? hangupCause ?? null : null,
      errorDetail: null,
    };
  }
  if (eventType === 'message.finalized') {
    const msgPayload = (payload.data.payload as TelnyxMessagingPayload['data']['payload']);
    const errors = msgPayload.errors;
    if (errors && errors.length > 0) {
      return {
        status: 'failed',
        errorCode: errors[0].code,
        errorDetail: errors[0].detail ?? errors[0].title,
      };
    }
    const toStatus = msgPayload.to?.[0]?.status;
    return { status: toStatus ?? 'delivered', errorCode: null, errorDetail: null };
  }
  if (eventType === 'email.bounced') {
    const emailPayload = (payload.data.payload as TelnyxEmailPayload['data']['payload']);
    return {
      status: 'bounced',
      errorCode: emailPayload.bounce_type ?? 'bounce',
      errorDetail: emailPayload.bounce_reason ?? null,
    };
  }
  if (eventType === 'email.spam_reported') {
    return { status: 'spam_reported', errorCode: 'spam', errorDetail: null };
  }
  if (eventType.startsWith('email.')) {
    const emailPayload = (payload.data.payload as TelnyxEmailPayload['data']['payload']);
    const errors = emailPayload.errors;
    if (errors && errors.length > 0) {
      return {
        status: 'failed',
        errorCode: errors[0].code,
        errorDetail: errors[0].detail ?? errors[0].title,
      };
    }
    return { status: eventType.split('.').pop() ?? null, errorCode: null, errorDetail: null };
  }
  return { status: eventType.split('.').pop() ?? null, errorCode: null, errorDetail: null };
}

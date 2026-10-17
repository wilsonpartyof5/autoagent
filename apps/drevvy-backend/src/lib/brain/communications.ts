/**
 * Store every Telnyx call, text, and email on brain_vendor_events.
 * Recording bytes go to the private call-recordings bucket. Retries upsert
 * the same vendor event and keep transcript or recording values already saved.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { insertBrainVendorEvent, type BrainVendorEvent } from './repository';
import { selectSender, voiceNumberLeaks, type ConversationIdentity } from './identity';
import type { IdentityRouter } from './identity-store';
import { resolveLiveIdentity, type LiveAssignment } from './live-send';
import {
  createOutboundSms,
  createOutboundEmail,
  createTexmlAiCall,
  createOutboundCall,
  downloadRecordingMp3,
  fetchTelnyxConversation,
  flagTestParties,
  normalizePhone,
  normalizeTelnyxPayload,
  parseStructuredCallResult,
  recordingObjectPath,
  sanitizeTelnyxPayload,
  seededTestNumbers,
  shouldDownloadRecording,
  shouldFetchTranscript,
  stripHtml,
  type CallLink,
  type StructuredCallResult,
} from './telnyx';

export type StoredVendorEvent = {
  id?: string;
  transcript?: string | null;
  summary?: string | null;
  body?: string | null;
  recording_path?: string | null;
  recording_status?: string | null;
  duration_s?: number | null;
  structured?: unknown;
  from_address?: string | null;
  to_address?: string | null;
};

export type CallContext = {
  dealId: string | null;
  dealerId: string | null;
  touchpoint: string | null;
};

export type CallArtifactPatch = {
  callControlId: string | null;
  dealId: string | null;
  touchpoint: string | null;
  channel: 'call' | 'sms' | 'email' | 'voicemail' | null;
  direction: 'outbound' | 'inbound' | null;
  transcript: string | null;
  summary: string | null;
  body: string | null;
  durationS: number | null;
  status: string | null;
  recordingPath: string | null;
  recordingStatus: string | null;
  isTest: boolean;
  conversationType: 'ai_to_ai_test' | null;
  structured: StructuredCallResult | null;
  from: string | null;
  to: string | null;
  conversationIdentityId?: string | null;
};

export type CommunicationsStore = {
  testNumbers(): Promise<Set<string>>;
  findByVendorEvent(vendorEventId: string, eventType: string): Promise<StoredVendorEvent | null>;
  findCallContext(input: { callControlId: string | null; from: string | null; to: string | null }): Promise<CallContext | null>;
  save(event: BrainVendorEvent): Promise<{ id: string } | { error: string }>;
  attach(patch: CallArtifactPatch): Promise<void>;
  uploadRecording(path: string, bytes: Uint8Array): Promise<boolean>;
};

export type IngestResult = {
  httpStatus: number;
  received: boolean;
  id: string | null;
};

type IngestDeps = {
  store: CommunicationsStore;
  apiKey: string | null;
  fetchImpl?: typeof fetch;
  router?: IdentityRouter;
};

export function supabaseCommunicationsStore(supabase: SupabaseClient): CommunicationsStore {
  return {
    async testNumbers() {
      const { data, error } = await supabase.from('labeled_numbers').select('phone_e164, kind');
      if (error || !data) return seededTestNumbers();
      const numbers = new Set<string>();
      for (const row of data) {
        if (row.kind !== 'test') continue;
        const phone = normalizePhone(row.phone_e164);
        if (phone) numbers.add(phone);
      }
      return numbers.size > 0 ? numbers : seededTestNumbers();
    },
    async findByVendorEvent(vendorEventId, eventType) {
      const { data } = await supabase
        .from('brain_vendor_events')
        .select('id, transcript, summary, body, recording_path, recording_status, duration_s, structured, from_address, to_address')
        .eq('vendor', 'telnyx')
        .eq('vendor_event_id', vendorEventId)
        .eq('event_type', eventType)
        .maybeSingle();
      return data ?? null;
    },
    async findCallContext({ callControlId, from, to }) {
      if (callControlId) {
        const { data } = await supabase
          .from('brain_vendor_events')
          .select('deal_id, dealer_id, touchpoint')
          .eq('vendor', 'telnyx')
          .eq('call_control_id', callControlId)
          .not('deal_id', 'is', null)
          .limit(1)
          .maybeSingle();
        if (data?.deal_id) {
          return {
            dealId: data.deal_id ?? null,
            dealerId: data.dealer_id ?? null,
            touchpoint: data.touchpoint ?? null,
          };
        }
      }
      const fromPhone = normalizePhone(from);
      const toPhone = normalizePhone(to);
      if (!fromPhone || !toPhone) return null;
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('brain_vendor_events')
        .select('deal_id, dealer_id, touchpoint, from_address, to_address')
        .eq('vendor', 'telnyx')
        .eq('event_type', 'call.queued')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(20);
      const match = (data ?? []).find((row) => (
        normalizePhone(row.from_address) === fromPhone
        && normalizePhone(row.to_address) === toPhone
        && row.deal_id
      ));
      if (!match?.deal_id) return null;
      return {
        dealId: match.deal_id,
        dealerId: match.dealer_id ?? null,
        touchpoint: match.touchpoint ?? null,
      };
    },
    save(event) {
      return insertBrainVendorEvent(supabase, event);
    },
    async attach(patch) {
      await attachCallArtifacts(supabase, patch);
    },
    async uploadRecording(path, bytes) {
      const { error } = await supabase.storage.from('call-recordings').upload(path, Buffer.from(bytes), {
        contentType: 'audio/mpeg',
        upsert: true,
      });
      return !error;
    },
  };
}

export async function ingestTelnyxPayload(payload: unknown, deps: IngestDeps): Promise<IngestResult> {
  const normalized = normalizeTelnyxPayload(payload);
  if (!normalized) return { httpStatus: 400, received: false, id: null };

  const testNumbers = await deps.store.testNumbers();
  let dealId = normalized.clientState.dealId ?? null;
  let dealerId = normalized.clientState.dealerId ?? null;
  let touchpoint = normalized.clientState.touchpoint ?? null;
  let identityId = normalized.clientState.conversationId ?? null;
  if (deps.router) {
    const routed = await deps.router.route({
      channel: normalized.channel,
      to: normalized.to,
      from: normalized.from,
      inReplyTo: normalized.inReplyTo,
      references: normalized.references,
      clientState: normalized.clientState,
    });
    if (routed) {
      identityId = routed.conversationId;
      dealId = routed.dealId;
      dealerId = routed.dealerId;
    }
  }
  if (!dealId) {
    const prior = await deps.store.findCallContext({
      callControlId: normalized.callControlId,
      from: normalized.from,
      to: normalized.to,
    });
    if (prior) {
      dealId = prior.dealId;
      dealerId = dealerId ?? prior.dealerId;
      touchpoint = touchpoint ?? prior.touchpoint;
    }
  }

  const flag = flagTestParties(normalized.from, normalized.to, testNumbers);
  const existing = await deps.store.findByVendorEvent(normalized.vendorEventId, normalized.eventType);

  let transcript = normalized.inlineTranscript;
  let summary = normalized.summary;
  let transcriptMissing = false;
  if (shouldFetchTranscript(normalized.eventType) && normalized.conversationId && deps.apiKey) {
    const fetched = await fetchTelnyxConversation(normalized.conversationId, deps.apiKey, deps.fetchImpl);
    if (fetched.ok) {
      transcript = fetched.transcript || transcript;
      summary = fetched.summary ?? summary;
    } else if (!transcript) {
      transcriptMissing = normalized.eventType !== 'call.hangup';
    }
  }

  if ((normalized.channel === 'sms' || normalized.channel === 'email') && normalized.body) {
    transcript = normalized.channel === 'email' ? stripHtml(normalized.body) : normalized.body;
  }

  const structured = normalized.channel === 'call' || normalized.channel === 'voicemail'
    ? parseStructuredCallResult({
      texts: [transcript, summary, ...normalized.insightTexts],
      toolCalls: normalized.toolCalls,
      machine: normalized.machine,
    })
    : null;

  let recordingPath = blankToNull(existing?.recording_path);
  let recordingStatus = blankToNull(existing?.recording_status);
  let recordingFailed = false;
  if (shouldDownloadRecording(normalized.eventType) && normalized.recordingUrl && !recordingPath) {
    const bytes = await downloadRecordingMp3(normalized.recordingUrl, deps.apiKey, deps.fetchImpl);
    if (!bytes) {
      recordingFailed = true;
      recordingStatus = 'failed';
    } else {
      const path = recordingObjectPath(normalized.callControlId, normalized.recordingId);
      const uploaded = await deps.store.uploadRecording(path, bytes);
      if (!uploaded) {
        recordingFailed = true;
        recordingStatus = 'failed';
      } else {
        recordingPath = path;
        recordingStatus = 'stored';
      }
    }
  }

  const event: BrainVendorEvent = {
    vendor: 'telnyx',
    vendor_event_id: normalized.vendorEventId,
    event_type: normalized.eventType,
    channel: normalized.channel,
    direction: normalized.direction,
    deal_id: dealId,
    dealer_id: dealerId,
    touchpoint,
    variant: normalized.clientState.variant ?? null,
    status: normalized.status,
    error_code: normalized.errorCode,
    error_detail: normalized.errorDetail,
    duration_s: normalized.durationS ?? existing?.duration_s ?? null,
    transcript: prefer(transcript, existing?.transcript),
    summary: prefer(summary, existing?.summary),
    occurred_at: normalized.occurredAt,
    signature_verified: true,
    payload: sanitizeTelnyxPayload(payload),
    from_address: prefer(normalized.from, existing?.from_address),
    to_address: prefer(normalized.to, existing?.to_address),
    body: prefer(normalized.body, existing?.body),
    recording_path: recordingPath,
    recording_status: recordingStatus,
    is_test: flag.isTest,
    conversation_type: flag.conversationType,
    structured: mergeStructured(structured, existing?.structured),
    call_control_id: normalized.callControlId,
    conversation_id: normalized.conversationId,
    conversation_identity_id: identityId,
  };

  const saved = await deps.store.save(event);
  if ('error' in saved) {
    console.error('[Telnyx webhook] could not store event');
    return { httpStatus: 500, received: true, id: null };
  }

  await deps.store.attach({
    callControlId: normalized.callControlId,
    dealId,
    touchpoint,
    channel: normalized.channel,
    direction: normalized.direction,
    transcript: event.transcript ?? null,
    summary: event.summary ?? null,
    body: event.body ?? null,
    durationS: event.duration_s ?? null,
    status: event.status,
    recordingPath,
    recordingStatus,
    isTest: flag.isTest,
    conversationType: flag.conversationType,
    structured,
    from: event.from_address ?? null,
    to: event.to_address ?? null,
    conversationIdentityId: identityId,
  });

  const inbound = normalized.direction === 'inbound' || normalized.eventType.endsWith('.received');
  if (deps.router && inbound && !dealId && !identityId && normalized.channel) {
    await deps.router.recordUnmatched({
      channel: normalized.channel,
      from: normalized.from,
      to: normalized.to,
      body: event.body ?? null,
      inReplyTo: normalized.inReplyTo,
      references: normalized.references,
      isTest: flag.isTest,
    });
  }

  if (recordingFailed || transcriptMissing) {
    return { httpStatus: 500, received: true, id: saved.id };
  }
  return { httpStatus: 200, received: true, id: saved.id };
}

export async function placeTexmlAiCall(
  store: CommunicationsStore,
  input: {
    connectionId: string;
    from: string;
    to: string;
    assistantId: string;
    webhookUrl?: string;
    link: CallLink;
    apiKey: string;
    fetchImpl?: typeof fetch;
    identity?: ConversationIdentity | null;
    testMode?: boolean;
    assignment?: LiveAssignment | null;
    script?: string | null;
  },
): Promise<{ callSid: string | null } | { error: string; held?: boolean; purchaseFlag?: boolean }> {
  const resolved = await resolveLiveIdentity({
    channel: 'voice',
    testMode: input.testMode === true,
    identity: input.identity,
    assignment: input.assignment,
    dealId: input.link.dealId,
    dealerId: input.link.dealerId,
  });
  if (resolved.held) return resolved;
  const sender = selectSender({
    channel: 'voice',
    identity: resolved.identity,
    testMode: input.testMode === true,
    fallback: { voice: input.from, sms: input.from },
  });
  if ('error' in sender) return sender;
  if (input.script && voiceNumberLeaks(input.script, sender.from)) {
    return { error: 'The voice agent must not give its caller ID out.' };
  }
  const link = withConversation(input.link, sender.conversationId);
  const created = await createTexmlAiCall({ ...input, from: sender.from, link }, { apiKey: input.apiKey, fetchImpl: input.fetchImpl });
  if ('error' in created) return created;
  await rememberCall(store, {
    callControlId: created.callSid,
    from: sender.from,
    to: input.to,
    link,
    eventType: 'call.queued',
  });
  return { callSid: created.callSid };
}

export async function placeOutboundCall(
  store: CommunicationsStore,
  input: {
    connectionId: string;
    from: string;
    to: string;
    webhookUrl?: string;
    link: CallLink;
    apiKey: string;
    fetchImpl?: typeof fetch;
    identity?: ConversationIdentity | null;
    testMode?: boolean;
    assignment?: LiveAssignment | null;
  },
): Promise<{ callControlId: string | null } | { error: string; held?: boolean; purchaseFlag?: boolean }> {
  const resolved = await resolveLiveIdentity({
    channel: 'voice',
    testMode: input.testMode === true,
    identity: input.identity,
    assignment: input.assignment,
    dealId: input.link.dealId,
    dealerId: input.link.dealerId,
  });
  if (resolved.held) return resolved;
  const sender = selectSender({
    channel: 'voice',
    identity: resolved.identity,
    testMode: input.testMode === true,
    fallback: { voice: input.from, sms: input.from },
  });
  if ('error' in sender) return sender;
  const link = withConversation(input.link, sender.conversationId);
  const created = await createOutboundCall({ ...input, from: sender.from, link }, { apiKey: input.apiKey, fetchImpl: input.fetchImpl });
  if ('error' in created) return created;
  await rememberCall(store, {
    callControlId: created.callControlId,
    from: sender.from,
    to: input.to,
    link,
    eventType: 'call.queued',
  });
  return { callControlId: created.callControlId };
}

export async function sendOutboundSms(
  store: CommunicationsStore,
  input: {
    from: string;
    to: string;
    text: string;
    webhookUrl?: string;
    link?: CallLink;
    apiKey: string;
    fetchImpl?: typeof fetch;
    identity?: ConversationIdentity | null;
    testMode?: boolean;
    assignment?: LiveAssignment | null;
    router?: IdentityRouter;
  },
): Promise<{ messageId: string | null } | { error: string; held?: boolean; purchaseFlag?: boolean }> {
  const resolved = await resolveLiveIdentity({
    channel: 'sms',
    testMode: input.testMode === true,
    identity: input.identity,
    assignment: input.assignment,
    dealId: input.link?.dealId,
    dealerId: input.link?.dealerId,
  });
  if (resolved.held) return resolved;
  const sender = selectSender({
    channel: 'sms',
    identity: resolved.identity,
    testMode: input.testMode === true,
    fallback: { sms: input.from },
  });
  if ('error' in sender) return sender;
  const link = input.link ? withConversation(input.link, sender.conversationId) : undefined;
  const created = await createOutboundSms({ ...input, from: sender.from }, { apiKey: input.apiKey, fetchImpl: input.fetchImpl });
  if ('error' in created) return created;
  await storeMessage(store, {
    vendorEventId: created.messageId ?? `sms-${link?.dealId ?? 'na'}-${Date.now()}`,
    eventType: 'message.submitted',
    channel: 'sms',
    from: sender.from,
    to: input.to,
    body: input.text,
    link: link ?? null,
    conversationIdentityId: sender.conversationId,
  });
  if (input.router && sender.conversationId) {
    await input.router.remember({
      conversationId: sender.conversationId,
      channel: 'sms',
      ourAddress: sender.from,
      theirAddress: input.to,
      messageId: created.messageId,
    });
  }
  return created;
}

export async function sendOutboundEmail(
  store: CommunicationsStore,
  input: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string | null;
    webhookUrl?: string;
    link?: CallLink | null;
    apiKey: string;
    fetchImpl?: typeof fetch;
    identity?: ConversationIdentity | null;
    testMode?: boolean;
    assignment?: LiveAssignment | null;
    displayName?: string | null;
    router?: IdentityRouter;
  },
): Promise<{ messageId: string | null } | { error: string; held?: boolean; purchaseFlag?: boolean }> {
  const resolved = await resolveLiveIdentity({
    channel: 'email',
    testMode: input.testMode === true,
    identity: input.identity,
    assignment: input.assignment,
    dealId: input.link?.dealId,
    dealerId: input.link?.dealerId,
  });
  if (resolved.held) return resolved;
  const sender = selectSender({
    channel: 'email',
    identity: resolved.identity,
    testMode: input.testMode === true,
    fallback: { email: input.from, firstName: input.displayName },
  });
  if ('error' in sender || !sender.replyTo) return 'error' in sender ? sender : { error: 'Email needs a reply address.' };
  const link = input.link ? withConversation(input.link, sender.conversationId) : undefined;
  const created = await createOutboundEmail({
    from: sender.from,
    replyTo: sender.replyTo,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    webhookUrl: input.webhookUrl,
    link,
  }, { apiKey: input.apiKey, fetchImpl: input.fetchImpl });
  if ('error' in created) return created;
  const vendorEventId = created.messageId ?? `email-${link?.dealId ?? 'na'}-${Date.now()}`;
  const stored = await storeOutboundEmail(store, {
    from: sender.from,
    replyTo: sender.replyTo,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    vendorEventId,
    link,
    identity: input.identity,
    testMode: true,
    displayName: sender.displayName,
    conversationIdentityId: sender.conversationId,
  });
  if ('error' in stored) return stored;
  if (input.router && sender.conversationId) {
    await input.router.remember({
      conversationId: sender.conversationId,
      channel: 'email',
      ourAddress: sender.replyTo,
      theirAddress: input.to,
      messageId: created.messageId,
    });
  }
  return created;
}

export async function storeOutboundEmail(
  store: CommunicationsStore,
  input: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string | null;
    vendorEventId?: string;
    link?: CallLink | null;
    identity?: ConversationIdentity | null;
    testMode?: boolean;
    displayName?: string | null;
    replyTo?: string | null;
    conversationIdentityId?: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const sender = input.replyTo
    ? {
      from: input.from,
      replyTo: input.replyTo,
      conversationId: input.conversationIdentityId ?? input.identity?.id ?? null,
    }
    : selectSender({
      channel: 'email',
      identity: input.identity ?? null,
      testMode: input.testMode === true,
      fallback: { email: input.from, firstName: input.displayName },
    });
  if ('error' in sender) return sender;
  const copy = input.html?.trim()
    ? `Subject: ${input.subject}\n\n${input.html}`
    : `Subject: ${input.subject}\n\n${input.text}`;
  return storeMessage(store, {
    vendorEventId: input.vendorEventId ?? `email-${input.link?.dealId ?? 'na'}-${Date.now()}`,
    eventType: 'email.submitted',
    channel: 'email',
    from: sender.from,
    to: input.to,
    body: copy,
    link: input.link ? withConversation(input.link, sender.conversationId) : null,
    replyTo: sender.replyTo,
    conversationIdentityId: sender.conversationId,
  });
}

async function rememberCall(
  store: CommunicationsStore,
  input: {
    callControlId: string | null;
    from: string;
    to: string;
    link: CallLink;
    eventType: string;
  },
): Promise<void> {
  const numbers = await store.testNumbers();
  const flag = flagTestParties(input.from, input.to, numbers);
  await store.save({
    vendor: 'telnyx',
    vendor_event_id: input.callControlId ?? `${input.link.dealId}:${input.link.touchpointId}:${input.from}:${input.to}`,
    event_type: input.eventType,
    channel: 'call',
    direction: 'outbound',
    deal_id: input.link.dealId,
    dealer_id: input.link.dealerId,
    touchpoint: input.link.touchpointId,
    variant: input.link.variant ?? null,
    status: 'queued',
    error_code: null,
    error_detail: null,
    duration_s: null,
    transcript: null,
    summary: null,
    occurred_at: new Date().toISOString(),
    signature_verified: false,
    payload: { stored: 'outbound_call' },
    from_address: input.from,
    to_address: input.to,
    body: null,
    recording_path: null,
    recording_status: null,
    is_test: flag.isTest,
    conversation_type: flag.conversationType,
    structured: null,
    call_control_id: input.callControlId,
    conversation_id: null,
    conversation_identity_id: input.link.conversationId ?? null,
  });
}

async function storeMessage(
  store: CommunicationsStore,
  input: {
    vendorEventId: string;
    eventType: string;
    channel: 'sms' | 'email';
    from: string;
    to: string;
    body: string;
    link: CallLink | null;
    replyTo?: string | null;
    conversationIdentityId?: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const numbers = await store.testNumbers();
  const flag = flagTestParties(input.from, input.to, numbers);
  const saved = await store.save({
    vendor: 'telnyx',
    vendor_event_id: input.vendorEventId,
    event_type: input.eventType,
    channel: input.channel,
    direction: 'outbound',
    deal_id: input.link?.dealId ?? null,
    dealer_id: input.link?.dealerId ?? null,
    touchpoint: input.link?.touchpointId ?? null,
    variant: input.link?.variant ?? null,
    status: 'queued',
    error_code: null,
    error_detail: null,
    duration_s: null,
    transcript: input.channel === 'email' ? stripHtml(input.body) : input.body,
    summary: null,
    occurred_at: new Date().toISOString(),
    signature_verified: false,
    payload: {
      stored: `outbound_${input.channel}`,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    },
    from_address: input.from,
    to_address: input.to,
    body: input.body,
    recording_path: null,
    recording_status: null,
    is_test: flag.isTest,
    conversation_type: flag.conversationType,
    structured: null,
    call_control_id: null,
    conversation_id: null,
    conversation_identity_id: input.conversationIdentityId ?? input.link?.conversationId ?? null,
  });
  if ('error' in saved) return saved;
  await store.attach({
    callControlId: null,
    dealId: input.link?.dealId ?? null,
    touchpoint: input.link?.touchpointId ?? null,
    channel: input.channel,
    direction: 'outbound',
    transcript: input.channel === 'email' ? stripHtml(input.body) : input.body,
    summary: null,
    body: input.body,
    durationS: null,
    status: 'queued',
    recordingPath: null,
    recordingStatus: null,
    isTest: flag.isTest,
    conversationType: flag.conversationType,
    structured: null,
    from: input.from,
    to: input.to,
    conversationIdentityId: input.conversationIdentityId ?? input.link?.conversationId ?? null,
  });
  return saved;
}

function withConversation(link: CallLink, conversationId: string | null): CallLink {
  if (!conversationId || link.conversationId) return link;
  return { ...link, conversationId };
}

async function attachCallArtifacts(supabase: SupabaseClient, patch: CallArtifactPatch): Promise<void> {
  const vendorUpdate: Record<string, unknown> = {
    is_test: patch.isTest,
    conversation_type: patch.conversationType,
  };
  if (patch.transcript) vendorUpdate.transcript = patch.transcript;
  if (patch.summary) vendorUpdate.summary = patch.summary;
  if (patch.body) vendorUpdate.body = patch.body;
  if (patch.durationS != null) vendorUpdate.duration_s = patch.durationS;
  if (patch.recordingPath) vendorUpdate.recording_path = patch.recordingPath;
  if (patch.recordingStatus) vendorUpdate.recording_status = patch.recordingStatus;
  if (patch.structured) vendorUpdate.structured = patch.structured;
  if (patch.from) vendorUpdate.from_address = patch.from;
  if (patch.to) vendorUpdate.to_address = patch.to;
  if (patch.dealId) vendorUpdate.deal_id = patch.dealId;
  if (patch.touchpoint) vendorUpdate.touchpoint = patch.touchpoint;
  if (patch.conversationIdentityId) vendorUpdate.conversation_identity_id = patch.conversationIdentityId;

  if (patch.callControlId) {
    await supabase.from('brain_vendor_events').update(vendorUpdate).eq('vendor', 'telnyx').eq('call_control_id', patch.callControlId);
  }

  if (!patch.dealId || !patch.touchpoint || !patch.channel) return;
  const outreachUpdate: Record<string, unknown> = {
    is_test: patch.isTest,
    conversation_type: patch.conversationType,
  };
  if (patch.body) outreachUpdate.body = patch.body;
  if (patch.transcript) outreachUpdate.transcript = patch.transcript;
  if (patch.summary) outreachUpdate.summary = patch.summary;
  if (patch.from) outreachUpdate.from_address = patch.from;
  if (patch.to) outreachUpdate.to_address = patch.to;
  if (patch.recordingPath) outreachUpdate.recording_path = patch.recordingPath;
  if (patch.conversationIdentityId) outreachUpdate.conversation_identity_id = patch.conversationIdentityId;
  if (patch.durationS != null && (patch.channel === 'call' || patch.channel === 'voicemail')) {
    outreachUpdate.call_duration_s = patch.durationS;
  }
  if (patch.structured?.textableNumber) {
    outreachUpdate.captured_number = patch.structured.textableNumber;
    outreachUpdate.call_outcome = 'number_captured';
  } else if (patch.structured?.voicemailLeft) {
    outreachUpdate.call_outcome = 'voicemail';
  }
  const outreachStatus = mapOutreachStatus(patch.status);
  if (outreachStatus) outreachUpdate.status = outreachStatus;

  await supabase
    .from('outreach_events')
    .update(outreachUpdate)
    .eq('deal_id', patch.dealId)
    .eq('touchpoint', patch.touchpoint)
    .eq('channel', patch.channel === 'voicemail' ? 'voicemail' : patch.channel)
    .eq('direction', patch.direction ?? 'outbound');
}

function mapOutreachStatus(status: string | null): string | null {
  if (!status) return null;
  if (['queued', 'sent', 'delivered', 'bounced', 'failed', 'skipped_not_textable'].includes(status)) return status;
  if (status === 'completed' || status === 'received' || status === 'answered' || status === 'saved' || status === 'analyzed') {
    return 'delivered';
  }
  if (status === 'bounced') return 'bounced';
  return null;
}

function prefer(incoming: string | null | undefined, prior: string | null | undefined): string | null {
  if (incoming && incoming.trim()) return incoming;
  if (prior && prior.trim()) return prior;
  return null;
}

function blankToNull(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

function mergeStructured(next: StructuredCallResult | null, prior: unknown): StructuredCallResult | null {
  const previous = readStructured(prior);
  if (!next) return previous;
  if (!previous) return next;
  return {
    textableNumber: next.textableNumber ?? previous.textableNumber,
    email: next.email ?? previous.email,
    goalReached: next.goalReached || previous.goalReached,
    voicemailLeft: next.voicemailLeft || previous.voicemailLeft,
  };
}

function readStructured(value: unknown): StructuredCallResult | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    textableNumber: typeof record.textableNumber === 'string' ? record.textableNumber : null,
    email: typeof record.email === 'string' ? record.email : null,
    goalReached: record.goalReached === true,
    voicemailLeft: record.voicemailLeft === true,
  };
}

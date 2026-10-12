import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  verifyTelnyxSignature,
  parseClientState,
  mapTelnyxEventToChannel,
  mapTelnyxEventToStatus,
  stripHtml,
  type TelnyxPayload,
  type TelnyxCallPayload,
  type TelnyxMessagingPayload,
  type TelnyxEmailPayload,
} from '@/lib/brain/telnyx';
import { insertBrainVendorEvent, type BrainVendorEvent } from '@/lib/brain/repository';
import { recordEmailOptout, type EmailOptoutReason } from '@/lib/brain/email-optout';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY ?? null;

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Webhook signature verification not configured' },
      { status: 401 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');

  const verification = verifyTelnyxSignature(rawBody, signature, timestamp, publicKey);

  if (!verification.valid) {
    return NextResponse.json(
      { error: 'Invalid signature', reason: verification.reason },
      { status: 401 },
    );
  }

  let payload: TelnyxPayload;
  try {
    payload = JSON.parse(rawBody) as TelnyxPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const eventType = payload.data.event_type;
  const vendorEventId = payload.data.id;
  const occurredAt = payload.data.occurred_at;

  const channel = mapTelnyxEventToChannel(eventType);
  const { status, errorCode, errorDetail } = mapTelnyxEventToStatus(payload);

  let direction: 'outbound' | 'inbound' | null = null;
  let clientState: { dealId?: string; dealerId?: string; touchpoint?: string; variant?: string } = {};
  let durationS: number | null = null;
  let transcript: string | null = null;

  if (eventType.startsWith('call.')) {
    const callPayload = payload.data.payload as TelnyxCallPayload['data']['payload'];
    direction = callPayload.direction ?? null;
    clientState = parseClientState(callPayload.client_state);

    if (callPayload.start_time && callPayload.end_time) {
      const startMs = Date.parse(callPayload.start_time);
      const endMs = Date.parse(callPayload.end_time);
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        durationS = Math.round((endMs - startMs) / 1000);
      }
    }
  } else if (eventType.startsWith('message.')) {
    const msgPayload = payload.data.payload as TelnyxMessagingPayload['data']['payload'];
    direction = msgPayload.direction ?? null;
    transcript = msgPayload.text ?? null;
  } else if (eventType.startsWith('email.')) {
    const emailPayload = payload.data.payload as TelnyxEmailPayload['data']['payload'];
    direction = emailPayload.direction ?? null;
    clientState = parseClientState(emailPayload.client_state);
    const rawTranscript = emailPayload.body?.plain ?? emailPayload.body?.html ?? null;
    transcript = rawTranscript ? stripHtml(rawTranscript) : null;

    if (eventType === 'email.unsubscribed' || eventType === 'email.spam_reported') {
      const fromEmail = emailPayload.from;
      if (fromEmail) {
        const reason: EmailOptoutReason = eventType === 'email.unsubscribed' ? 'unsubscribed' : 'spam_reported';
        await recordEmailOptout(supabase, fromEmail, reason, vendorEventId);
      }
    }
  }

  const event: BrainVendorEvent = {
    vendor: 'telnyx',
    vendor_event_id: vendorEventId,
    event_type: eventType,
    channel,
    direction,
    deal_id: clientState.dealId ?? null,
    dealer_id: clientState.dealerId ?? null,
    touchpoint: clientState.touchpoint ?? null,
    variant: clientState.variant ?? null,
    status,
    error_code: errorCode,
    error_detail: errorDetail,
    duration_s: durationS,
    transcript,
    summary: null,
    occurred_at: occurredAt,
    signature_verified: true,
    payload: sanitizePayloadForStorage(payload),
  };

  const result = await insertBrainVendorEvent(supabase, event);

  if ('error' in result) {
    console.error('[Telnyx webhook] Insert error:', result.error);
  }

  return NextResponse.json({ received: true, id: 'id' in result ? result.id : null });
}

function sanitizePayloadForStorage(payload: TelnyxPayload): Record<string, unknown> {
  const sanitized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const data = sanitized.data as Record<string, unknown> | undefined;
  if (data?.payload) {
    const innerPayload = data.payload as Record<string, unknown>;
    delete innerPayload.client_state;
    delete innerPayload.sip_headers;
    delete innerPayload.custom_headers;
  }
  return sanitized;
}

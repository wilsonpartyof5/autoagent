import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  verifyTelnyxSignature,
  parseClientState,
  mapTelnyxEventToChannel,
  mapTelnyxEventToStatus,
  type TelnyxPayload,
  type TelnyxCallPayload,
  type TelnyxMessagingPayload,
} from '@/lib/brain/telnyx';
import { insertBrainVendorEvent, type BrainVendorEvent } from '@/lib/brain/repository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY ?? null;
  const rawBody = await request.text();
  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');

  const verification = verifyTelnyxSignature(rawBody, signature, timestamp, publicKey);

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
    signature_verified: verification.valid,
    payload,
  };

  const result = await insertBrainVendorEvent(supabase, event);

  if ('error' in result) {
    console.error('[Telnyx webhook] Insert error:', result.error);
  }

  if (!verification.valid) {
    console.warn('[Telnyx webhook] Signature verification failed:', verification.reason);
  }

  return NextResponse.json({ received: true, id: 'id' in result ? result.id : null });
}

import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  verifyElevenLabsSignature,
  parseElevenLabsDynamicVariables,
  formatTranscript,
  type ElevenLabsPostCallPayload,
} from '@/lib/brain/elevenlabs';
import { insertBrainVendorEvent, type BrainVendorEvent } from '@/lib/brain/repository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET ?? null;
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('elevenlabs-signature');

  const verification = verifyElevenLabsSignature(rawBody, signatureHeader, webhookSecret);

  let payload: ElevenLabsPostCallPayload;
  try {
    payload = JSON.parse(rawBody) as ElevenLabsPostCallPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.type !== 'post_call_transcription') {
    return NextResponse.json({ received: true, skipped: true });
  }

  const supabase = createAdminClient();

  const dynamicVars = parseElevenLabsDynamicVariables(payload);
  const transcript = formatTranscript(payload);
  const summary = payload.analysis?.transcript_summary ?? null;

  const event: BrainVendorEvent = {
    vendor: 'elevenlabs',
    vendor_event_id: payload.conversation_id,
    event_type: payload.type,
    channel: 'call',
    direction: 'outbound',
    deal_id: dynamicVars.dealId ?? null,
    dealer_id: dynamicVars.dealerId ?? null,
    touchpoint: dynamicVars.touchpoint ?? null,
    variant: dynamicVars.variant ?? null,
    status: payload.status,
    error_code: payload.status === 'failed' ? 'call_failed' : null,
    error_detail: null,
    duration_s: payload.call_duration_secs ?? null,
    transcript,
    summary,
    occurred_at: new Date(payload.event_timestamp * 1000).toISOString(),
    signature_verified: verification.valid,
    payload,
  };

  const result = await insertBrainVendorEvent(supabase, event);

  if ('error' in result) {
    console.error('[ElevenLabs webhook] Insert error:', result.error);
  }

  if (!verification.valid) {
    console.warn('[ElevenLabs webhook] Signature verification failed:', verification.reason);
  }

  return NextResponse.json({ received: true, id: 'id' in result ? result.id : null });
}

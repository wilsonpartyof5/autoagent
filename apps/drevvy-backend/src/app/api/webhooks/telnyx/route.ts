import { NextRequest, NextResponse } from 'next/server';

import { ingestTelnyxPayload, supabaseCommunicationsStore } from '@/lib/brain/communications';
import { recordEmailOptout, endDealOnOptout, type EmailOptoutReason } from '@/lib/brain/email-optout';
import { normalizeTelnyxPayload, parseClientState, verifyTelnyxSignature } from '@/lib/brain/telnyx';
import { ingestInboundSms } from '@/lib/sms/inbound';
import { createSupabaseSmsStore } from '@/lib/sms/store';
import { createAdminClient } from '@/lib/supabase/admin';

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

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createAdminClient();
  await recordOptOut(supabase, payload);

  const suppressionFailed = await recordInboundStop(supabase, payload);
  if (suppressionFailed) return suppressionFailed;

  const result = await ingestTelnyxPayload(payload, {
    store: supabaseCommunicationsStore(supabase),
    apiKey: process.env.TELNYX_API_KEY ?? null,
  });

  return NextResponse.json(
    { received: result.received, id: result.id },
    { status: result.httpStatus },
  );
}

/**
 * Inbound texts are checked for STOP-family replies before the webhook is
 * acknowledged. A failed suppression write returns 500 so Telnyx retries.
 */
async function recordInboundStop(
  supabase: ReturnType<typeof createAdminClient>,
  payload: unknown,
): Promise<NextResponse | null> {
  const normalized = normalizeTelnyxPayload(payload);
  if (!normalized || normalized.channel !== 'sms' || normalized.direction !== 'inbound') return null;

  try {
    await ingestInboundSms(createSupabaseSmsStore(supabase), {
      from: normalized.from,
      text: normalized.body,
      vendorEventId: normalized.vendorEventId,
      occurredAt: normalized.occurredAt,
    });
    return null;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'sms_opt_out_suppression_failed',
      vendorEventId: normalized.vendorEventId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return NextResponse.json({ error: 'opt_out_not_recorded' }, { status: 500 });
  }
}

async function recordOptOut(supabase: ReturnType<typeof createAdminClient>, payload: unknown): Promise<void> {
  if (!payload || typeof payload !== 'object') return;
  const data = (payload as { data?: { event_type?: string; id?: string; occurred_at?: string; payload?: Record<string, unknown> } }).data;
  const eventType = data?.event_type;
  if (eventType !== 'email.unsubscribed' && eventType !== 'email.spam_reported') return;
  const inner = data?.payload ?? {};
  const fromEmail = typeof inner.from === 'string' ? inner.from : null;
  const reason: EmailOptoutReason = eventType === 'email.unsubscribed' ? 'unsubscribed' : 'spam_reported';
  if (fromEmail && data?.id) {
    await recordEmailOptout(supabase, fromEmail, reason, data.id);
  }
  const clientState = parseClientState(typeof inner.client_state === 'string' ? inner.client_state : undefined);
  if (clientState.dealId) {
    await endDealOnOptout(clientState.dealId, reason, data?.occurred_at ?? new Date().toISOString());
  }
}

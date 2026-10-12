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

export function parseClientState(base64: string | undefined): { dealId?: string; dealerId?: string; touchpoint?: string; variant?: string } {
  if (!base64) return {};
  try {
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return {
      dealId: typeof parsed.dealId === 'string' ? parsed.dealId : undefined,
      dealerId: typeof parsed.dealerId === 'string' ? parsed.dealerId : undefined,
      touchpoint: typeof parsed.touchpoint === 'string' ? parsed.touchpoint : undefined,
      variant: typeof parsed.variant === 'string' ? parsed.variant : undefined,
    };
  } catch {
    return {};
  }
}

export function mapTelnyxEventToChannel(eventType: string): 'call' | 'sms' | 'email' | 'voicemail' | null {
  if (eventType.startsWith('call.')) return 'call';
  if (eventType.startsWith('message.')) return 'sms';
  if (eventType.startsWith('email.')) return 'email';
  return null;
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

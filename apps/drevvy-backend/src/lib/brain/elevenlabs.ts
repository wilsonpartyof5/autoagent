/**
 * ElevenLabs post-call webhook HMAC verification.
 * The documented header is "t=<unix>,v0=<hex>". The hex is HMAC-SHA256 of
 * `${timestamp}.${rawBody}`. A header may carry more than one v0 value; any
 * match is valid. v1 is accepted as well. Timestamps must fall inside the
 * five-minute tolerance window.
 * See: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
 */

import { createHmac, timingSafeEqual } from 'crypto';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

export type ElevenLabsSignatureResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Verify ElevenLabs webhook signature using HMAC-SHA256 over `timestamp.body`.
 * Accepts the documented v0 scheme and the legacy v1 scheme.
 */
export function verifyElevenLabsSignature(
  payload: string,
  signatureHeader: string | null,
  webhookSecret: string | null,
): ElevenLabsSignatureResult {
  if (!webhookSecret) {
    return { valid: false, reason: 'ELEVENLABS_WEBHOOK_SECRET not configured' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'Missing ElevenLabs-Signature header' };
  }

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v0=') || part.startsWith('v1='));

  if (!timestampPart || signatures.length === 0) {
    return { valid: false, reason: 'Invalid signature header format' };
  }

  const timestamp = timestampPart.slice(2);

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  const now = Date.now();
  if (Math.abs(now - timestampMs) > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, reason: 'Timestamp outside tolerance window' };
  }

  try {
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const matched = signatures.some((part) => hmacMatches(part.slice(3), expectedSignature));
    if (!matched) return { valid: false, reason: 'Signature verification failed' };
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, reason: `Signature verification error: ${message}` };
  }
}

function hmacMatches(provided: string, expectedHex: string): boolean {
  const hex = provided.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return false;
  const left = Buffer.from(hex, 'hex');
  const right = Buffer.from(expectedHex, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export type ElevenLabsPostCallPayload = {
  type: 'post_call_transcription';
  event_timestamp: number;
  conversation_id: string;
  agent_id: string;
  status: 'done' | 'failed';
  transcript?: string;
  transcript_object?: Array<{
    role: 'agent' | 'user';
    message: string;
    time_in_call_secs?: number;
  }>;
  metadata?: {
    conversation_initiation_client_data?: {
      dynamic_variables?: {
        dealId?: string;
        dealerId?: string;
        touchpoint?: string;
        variant?: string;
        [key: string]: string | undefined;
      };
    };
    [key: string]: unknown;
  };
  analysis?: {
    evaluation_criteria_results?: Record<string, { result?: string; rationale?: string }>;
    data_collection_results?: Record<string, { value?: string; rationale?: string }>;
    call_successful?: string;
    transcript_summary?: string;
  };
  call_duration_secs?: number;
  cost_info?: {
    total_cost_usd?: number;
    llm_cost_usd?: number;
    tts_cost_usd?: number;
  };
};

export function parseElevenLabsDynamicVariables(payload: ElevenLabsPostCallPayload): {
  dealId?: string;
  dealerId?: string;
  touchpoint?: string;
  variant?: string;
} {
  const vars = payload.metadata?.conversation_initiation_client_data?.dynamic_variables;
  if (!vars) return {};
  return {
    dealId: vars.dealId,
    dealerId: vars.dealerId,
    touchpoint: vars.touchpoint,
    variant: vars.variant,
  };
}

export function formatTranscript(payload: ElevenLabsPostCallPayload): string | null {
  if (payload.transcript) return payload.transcript;
  if (payload.transcript_object && payload.transcript_object.length > 0) {
    return payload.transcript_object
      .map((item) => `${item.role === 'agent' ? 'Drevvy' : 'Dealer'}: ${item.message}`)
      .join('\n');
  }
  return null;
}

/**
 * ElevenLabs post-call webhook HMAC verification.
 * See: https://elevenlabs.io/docs/api-reference/conversational-ai/webhooks
 */

import { createHmac, timingSafeEqual } from 'crypto';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

export type ElevenLabsSignatureResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Verify ElevenLabs webhook signature using HMAC-SHA256.
 * The signature header format is: "t=timestamp,v1=signature"
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

  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return { valid: false, reason: 'Invalid signature header format' };
  }

  const timestamp = timestampPart.slice(2);
  const signature = signaturePart.slice(3);

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

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'Signature verification failed' };
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, reason: 'Signature verification failed' };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, reason: `Signature verification error: ${message}` };
  }
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

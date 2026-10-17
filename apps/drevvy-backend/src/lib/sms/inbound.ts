import { detectSmsOptOut, normalizeSmsPhone, smsThreadKey } from './opt-out';
import type { SmsStore } from './store';

export type InboundSmsInput = {
  from: string | null;
  text: string | null;
  vendorEventId?: string | null;
  occurredAt: string;
  threadKey?: string | null;
  dealId?: string | null;
};

export type InboundSmsResult = {
  suppressed: boolean;
  reason: string | null;
  phone: string | null;
};

/**
 * Record an inbound text and, when it is an opt-out, suppress that number
 * before any later send can proceed.
 */
export async function ingestInboundSms(store: SmsStore, input: InboundSmsInput): Promise<InboundSmsResult> {
  const phone = normalizeSmsPhone(input.from);
  if (!phone) return { suppressed: false, reason: null, phone: null };

  const detection = detectSmsOptOut(input.text);
  const threadKey = smsThreadKey({ threadKey: input.threadKey, phone, dealId: input.dealId });
  const occurredAt = input.occurredAt || new Date().toISOString();

  try {
    await store.recordMessage({
      threadKey,
      phone,
      body: (input.text ?? '').slice(0, 2000),
      direction: 'inbound',
      optOutLineAppended: false,
      createdAt: occurredAt,
      telnyxId: input.vendorEventId ?? null,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'sms_inbound_record_failed',
      phoneLast4: phone.slice(-4),
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }

  if (!detection.optedOut) return { suppressed: false, reason: null, phone };

  await store.suppress({
    phone,
    reason: detection.reason,
    rawText: input.text,
    vendorEventId: input.vendorEventId ?? null,
  });

  console.log(JSON.stringify({
    event: 'sms_number_suppressed',
    phoneLast4: phone.slice(-4),
    reason: detection.reason,
  }));

  return { suppressed: true, reason: detection.reason, phone };
}

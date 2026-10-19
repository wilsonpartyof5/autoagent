/**
 * Telnyx SMS send gateway.
 * Appends "Reply STOP to opt out" from the operator setting, and refuses
 * every send to a suppressed number.
 */

import { outboundSmsHoldReason } from '@/lib/dealer/contact-phone';
import { createAdminClient } from '@/lib/supabase/admin';

import { normalizeSmsPhone, smsThreadKey } from './opt-out';
import { shouldAppendOptOutLine, withOptOutLine, type SmsOptOutLineSetting } from './opt-out-line';
import { createSupabaseSmsStore, type SmsStore } from './store';

const TELNYX_MESSAGES_URL = 'https://api.telnyx.com/v2/messages';

export type TelnyxSmsPostRequest = {
  to: string;
  from: string;
  text: string;
  messagingProfileId: string | null;
};

export type TelnyxSmsPoster = (
  request: TelnyxSmsPostRequest,
) => Promise<{ ok: true; id: string | null } | { ok: false; detail: string }>;

export type SendSmsInput = {
  to: string;
  body: string;
  threadKey?: string | null;
  dealId?: string | null;
};

export type SendSmsBlocked =
  | 'suppressed'
  | 'invalid_phone'
  | 'empty_body'
  | 'not_configured'
  | 'suppression_unavailable'
  | 'vendor_error'
  | 'ten_dlc_pending';

export type SendSmsResult =
  | { ok: true; id: string | null; body: string; optOutLineAppended: boolean; phone: string }
  | { ok: false; blocked: SendSmsBlocked };

export type SendSmsDeps = {
  store?: SmsStore;
  post?: TelnyxSmsPoster;
  now?: () => Date;
  fromNumber?: string | null;
  messagingProfileId?: string | null;
  apiKey?: string | null;
  /** Live texts stay off until TELNYX_10DLC_APPROVED=true. */
  tenDlcApproved?: boolean;
};

export async function sendSms(input: SendSmsInput, deps: SendSmsDeps = {}): Promise<SendSmsResult> {
  const phone = normalizeSmsPhone(input.to);
  if (!phone) return { ok: false, blocked: 'invalid_phone' };
  if (!input.body || input.body.trim() === '') return { ok: false, blocked: 'empty_body' };

  const store = deps.store ?? (await defaultStore());
  if (!store) return { ok: false, blocked: 'suppression_unavailable' };

  let suppressed = false;
  try {
    suppressed = await store.isSuppressed(phone);
  } catch {
    return { ok: false, blocked: 'suppression_unavailable' };
  }
  if (suppressed) return { ok: false, blocked: 'suppressed' };

  const now = deps.now?.() ?? new Date();
  const threadKey = smsThreadKey({ threadKey: input.threadKey, phone, dealId: input.dealId });
  let setting: SmsOptOutLineSetting = { mode: 'first_message_per_thread', silenceHours: null };
  try {
    setting = await store.getOptOutLineSetting();
  } catch {
    setting = { mode: 'first_message_per_thread', silenceHours: null };
  }
  let thread = { priorOutboundCount: 0, lastActivityAt: null as string | null };
  try {
    thread = await store.threadSnapshot(threadKey, phone);
  } catch {
    thread = { priorOutboundCount: 0, lastActivityAt: null };
  }

  const composed = withOptOutLine(input.body, shouldAppendOptOutLine({ setting, thread, now }));
  const fromNumber = deps.fromNumber === undefined ? process.env.TELNYX_FROM_NUMBER ?? null : deps.fromNumber;
  const apiKey = deps.apiKey === undefined ? process.env.TELNYX_API_KEY ?? null : deps.apiKey;
  if (!fromNumber || !apiKey) return { ok: false, blocked: 'not_configured' };
  if (outboundSmsHoldReason({ tenDlcApproved: deps.tenDlcApproved })) {
    return { ok: false, blocked: 'ten_dlc_pending' };
  }

  const post = deps.post ?? defaultPoster(apiKey);
  const messagingProfileId = deps.messagingProfileId === undefined
    ? process.env.TELNYX_MESSAGING_PROFILE_ID ?? null
    : deps.messagingProfileId;

  const posted = await post({
    to: phone,
    from: fromNumber,
    text: composed.body,
    messagingProfileId: messagingProfileId || null,
  });
  if (!posted.ok) return { ok: false, blocked: 'vendor_error' };

  try {
    await store.recordMessage({
      threadKey,
      phone,
      body: composed.body,
      direction: 'outbound',
      optOutLineAppended: composed.appended,
      createdAt: now.toISOString(),
      telnyxId: posted.id,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'sms_outbound_record_failed',
      phoneLast4: phone.slice(-4),
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }

  return {
    ok: true,
    id: posted.id,
    body: composed.body,
    optOutLineAppended: composed.appended,
    phone,
  };
}

async function defaultStore(): Promise<SmsStore | null> {
  try {
    return createSupabaseSmsStore(createAdminClient());
  } catch {
    return null;
  }
}

function defaultPoster(apiKey: string): TelnyxSmsPoster {
  return async (request) => {
    const payload: Record<string, string> = {
      from: request.from,
      to: request.to,
      text: request.text,
    };
    if (request.messagingProfileId) payload.messaging_profile_id = request.messagingProfileId;

    let response: Response;
    try {
      response = await fetch(TELNYX_MESSAGES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, detail: 'Telnyx request failed' };
    }

    if (!response.ok) return { ok: false, detail: `Telnyx responded ${response.status}` };
    try {
      const json = await response.json() as { data?: { id?: unknown } };
      const id = json.data?.id;
      return { ok: true, id: typeof id === 'string' ? id : null };
    } catch {
      return { ok: true, id: null };
    }
  };
}

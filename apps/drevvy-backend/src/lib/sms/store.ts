import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_SMS_OPT_OUT_LINE_SETTING,
  settingFromRow,
  type SmsOptOutLineSetting,
  type SmsThreadSnapshot,
} from './opt-out-line';

export type SmsMessageRecord = {
  threadKey: string;
  phone: string;
  body: string;
  direction: 'outbound' | 'inbound';
  optOutLineAppended: boolean;
  createdAt: string;
  telnyxId?: string | null;
};

export type SmsSuppressInput = {
  phone: string;
  reason: string;
  rawText: string | null;
  vendorEventId?: string | null;
};

export type SmsStore = {
  getOptOutLineSetting(): Promise<SmsOptOutLineSetting>;
  isSuppressed(phone: string): Promise<boolean>;
  suppress(input: SmsSuppressInput): Promise<void>;
  threadSnapshot(threadKey: string, phone: string): Promise<SmsThreadSnapshot>;
  recordMessage(input: SmsMessageRecord): Promise<void>;
};

type MemoryMessage = SmsMessageRecord;

export function createMemorySmsStore(initial?: { setting?: SmsOptOutLineSetting }): SmsStore & {
  setSetting(setting: SmsOptOutLineSetting): void;
} {
  let setting: SmsOptOutLineSetting = initial?.setting
    ? { ...initial.setting }
    : { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING };
  const suppressed = new Map<string, SmsSuppressInput>();
  const messages: MemoryMessage[] = [];

  return {
    setSetting(next) {
      setting = { ...next };
    },
    async getOptOutLineSetting() {
      return { ...setting };
    },
    async isSuppressed(phone) {
      return suppressed.has(phone);
    },
    async suppress(input) {
      suppressed.set(input.phone, input);
    },
    async threadSnapshot(threadKey, phone) {
      const related = messages.filter((row) => row.threadKey === threadKey || row.phone === phone);
      const priorOutboundCount = messages.filter(
        (row) => row.threadKey === threadKey && row.direction === 'outbound',
      ).length;
      const lastActivityAt = related.reduce<string | null>((latest, row) => {
        if (!latest || row.createdAt > latest) return row.createdAt;
        return latest;
      }, null);
      return { priorOutboundCount, lastActivityAt };
    },
    async recordMessage(input) {
      messages.push({ ...input });
    },
  };
}

export function createSupabaseSmsStore(supabase: SupabaseClient): SmsStore {
  return {
    async getOptOutLineSetting() {
      const { data, error } = await supabase
        .from('sms_send_settings')
        .select('opt_out_line_mode, opt_out_line_silence_hours')
        .eq('id', 'default')
        .maybeSingle();
      if (error || !data) return { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING };
      return settingFromRow(data);
    },
    async isSuppressed(phone) {
      const { data, error } = await supabase
        .from('sms_optouts')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (error) throw new Error('suppression_lookup_failed');
      return Boolean(data);
    },
    async suppress(input) {
      const { error } = await supabase.from('sms_optouts').upsert(
        {
          phone: input.phone,
          reason: input.reason,
          raw_text: input.rawText,
          vendor_event_id: input.vendorEventId ?? null,
        },
        { onConflict: 'phone' },
      );
      if (error) throw new Error('suppression_write_failed');
    },
    async threadSnapshot(threadKey, phone) {
      const [outbound, threadActivity, phoneActivity] = await Promise.all([
        supabase
          .from('sms_messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_key', threadKey)
          .eq('direction', 'outbound'),
        supabase
          .from('sms_messages')
          .select('created_at')
          .eq('thread_key', threadKey)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('sms_messages')
          .select('created_at')
          .eq('phone', phone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (outbound.error || threadActivity.error || phoneActivity.error) {
        throw new Error('thread_lookup_failed');
      }
      const stamps = [threadActivity.data?.created_at, phoneActivity.data?.created_at].filter(
        (value): value is string => typeof value === 'string',
      );
      stamps.sort();
      return {
        priorOutboundCount: outbound.count ?? 0,
        lastActivityAt: stamps.length > 0 ? stamps[stamps.length - 1] : null,
      };
    },
    async recordMessage(input) {
      const { error } = await supabase.from('sms_messages').insert({
        thread_key: input.threadKey,
        phone: input.phone,
        direction: input.direction,
        body: input.body,
        opt_out_line_appended: input.optOutLineAppended,
        telnyx_id: input.telnyxId ?? null,
        created_at: input.createdAt,
      });
      if (error) throw new Error('message_write_failed');
    },
  };
}

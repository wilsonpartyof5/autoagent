import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { adminPreviewEnabled } from '@/lib/admin/access';
import { createAdminClient } from '@/lib/supabase/admin';

import {
  DEFAULT_SMS_OPT_OUT_LINE_SETTING,
  parseSmsOptOutLineForm,
  settingFromRow,
  type SmsOptOutLineSetting,
} from './opt-out-line';

export type SmsOptOutLinePersistence = 'database' | 'preview' | 'default';

export type SmsOptOutLineAdminState = {
  setting: SmsOptOutLineSetting;
  persistence: SmsOptOutLinePersistence;
  notice: string | null;
};

const PREVIEW_NOTICE = 'Preview only. This choice stays on this server until the database is connected.';
const DEFAULT_NOTICE = 'Showing the safe default: the line is added on the first text of each thread.';
const TABLE_NOTICE = 'The opt-out line setting is still the safe default. The settings table is not available yet.';
const UNAVAILABLE_NOTICE = 'Supabase is not configured, so this choice stays on the safe default.';

const PREVIEW_FILE = join(tmpdir(), 'drevvy-sms-opt-out-line-preview.json');

export function resetPreviewSmsOptOutLineSetting(): void {
  try {
    unlinkSync(PREVIEW_FILE);
  } catch {
    // The preview file is absent until an operator saves a choice.
  }
}

export async function readSmsOptOutLineAdminState(): Promise<SmsOptOutLineAdminState> {
  if (!supabaseConfigured()) {
    if (adminPreviewEnabled()) {
      return {
        setting: readPreviewSetting(),
        persistence: 'preview',
        notice: PREVIEW_NOTICE,
      };
    }
    return {
      setting: { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING },
      persistence: 'default',
      notice: UNAVAILABLE_NOTICE,
    };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('sms_send_settings')
      .select('opt_out_line_mode, opt_out_line_silence_hours')
      .eq('id', 'default')
      .maybeSingle();
    if (error) {
      return {
        setting: { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING },
        persistence: 'default',
        notice: safeSettingsNotice(error.message),
      };
    }
    return {
      setting: settingFromRow(data),
      persistence: 'database',
      notice: data ? null : DEFAULT_NOTICE,
    };
  } catch {
    return {
      setting: { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING },
      persistence: 'default',
      notice: UNAVAILABLE_NOTICE,
    };
  }
}

export async function persistSmsOptOutLineSetting(
  setting: SmsOptOutLineSetting,
  updatedBy: string,
): Promise<{ ok: true; persistence: 'database' | 'preview' } | { ok: false; error: string }> {
  if (!supabaseConfigured()) {
    if (adminPreviewEnabled()) {
      writePreviewSetting(setting);
      return { ok: true, persistence: 'preview' };
    }
    return { ok: false, error: UNAVAILABLE_NOTICE };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('sms_send_settings').upsert(
      {
        id: 'default',
        opt_out_line_mode: setting.mode,
        opt_out_line_silence_hours: setting.silenceHours,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy.slice(0, 320),
      },
      { onConflict: 'id' },
    );
    if (error) return { ok: false, error: safeSettingsNotice(error.message) };
    return { ok: true, persistence: 'database' };
  } catch {
    return { ok: false, error: UNAVAILABLE_NOTICE };
  }
}

function readPreviewSetting(): SmsOptOutLineSetting {
  try {
    const raw = JSON.parse(readFileSync(PREVIEW_FILE, 'utf8')) as { mode?: unknown; silenceHours?: unknown };
    const parsed = parseSmsOptOutLineForm({
      mode: raw.mode,
      silenceHours: raw.silenceHours == null ? '' : raw.silenceHours,
    });
    if (!parsed.ok) return { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING };
    return parsed.setting;
  } catch {
    return { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING };
  }
}

function writePreviewSetting(setting: SmsOptOutLineSetting): void {
  writeFileSync(PREVIEW_FILE, JSON.stringify(setting));
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function safeSettingsNotice(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('sms_send_settings')
    || lower.includes('schema cache')
    || lower.includes('does not exist')
    || lower.includes('relation')
  ) {
    return TABLE_NOTICE;
  }
  return DEFAULT_NOTICE;
}

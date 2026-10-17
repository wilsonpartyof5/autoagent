/**
 * When the Telnyx send gateway appends the opt-out line.
 * The safe default is the first outbound text of a thread.
 */

export const SMS_OPT_OUT_LINE = 'Reply STOP to opt out';

export const SMS_OPT_OUT_LINE_MODES = ['first_message_per_thread', 'every_message', 'never'] as const;

export type SmsOptOutLineMode = (typeof SMS_OPT_OUT_LINE_MODES)[number];

export type SmsOptOutLineSetting = {
  mode: SmsOptOutLineMode;
  /** Optional. Also append after this many hours without a text on the thread. Ignored when mode is never. */
  silenceHours: number | null;
};

export const DEFAULT_SMS_OPT_OUT_LINE_SETTING: SmsOptOutLineSetting = {
  mode: 'first_message_per_thread',
  silenceHours: null,
};

export const SMS_OPT_OUT_LINE_MODE_LABELS: Record<SmsOptOutLineMode, string> = {
  first_message_per_thread: 'First text in each thread',
  every_message: 'Every text',
  never: 'Never',
};

const SILENCE_HOUR_MIN = 1;
const SILENCE_HOUR_MAX = 8760;
const OPT_OUT_LINE_PATTERN = /reply\s+stop\s+to\s+opt\s+out/i;

export function isSmsOptOutLineMode(value: unknown): value is SmsOptOutLineMode {
  return typeof value === 'string' && (SMS_OPT_OUT_LINE_MODES as readonly string[]).includes(value);
}

export function settingFromRow(row: {
  opt_out_line_mode?: unknown;
  opt_out_line_silence_hours?: unknown;
} | null | undefined): SmsOptOutLineSetting {
  if (!row) return { ...DEFAULT_SMS_OPT_OUT_LINE_SETTING };
  const mode = isSmsOptOutLineMode(row.opt_out_line_mode)
    ? row.opt_out_line_mode
    : DEFAULT_SMS_OPT_OUT_LINE_SETTING.mode;
  return {
    mode,
    silenceHours: silenceHoursFromStored(row.opt_out_line_silence_hours),
  };
}

export function parseSmsOptOutLineForm(input: {
  mode: unknown;
  silenceHours: unknown;
}): { ok: true; setting: SmsOptOutLineSetting } | { ok: false; error: string } {
  const mode = typeof input.mode === 'string' ? input.mode.trim() : '';
  if (!isSmsOptOutLineMode(mode)) {
    return { ok: false, error: 'Choose first text in each thread, every text, or never.' };
  }
  const silence = parseSilenceField(input.silenceHours);
  if (!silence.ok) return silence;
  return { ok: true, setting: { mode, silenceHours: silence.hours } };
}

export type SmsThreadSnapshot = {
  priorOutboundCount: number;
  lastActivityAt: string | null;
};

export function shouldAppendOptOutLine(input: {
  setting: SmsOptOutLineSetting;
  thread: SmsThreadSnapshot;
  now: Date;
}): boolean {
  if (input.setting.mode === 'never') return false;
  if (input.setting.mode === 'every_message') return true;
  if (input.thread.priorOutboundCount <= 0) return true;
  return silenceElapsed(input.setting.silenceHours, input.thread.lastActivityAt, input.now);
}

export function withOptOutLine(body: string, append: boolean): { body: string; appended: boolean } {
  const trimmed = body.trim();
  if (!append || OPT_OUT_LINE_PATTERN.test(trimmed)) {
    return { body: trimmed, appended: false };
  }
  return { body: `${trimmed} ${SMS_OPT_OUT_LINE}`, appended: true };
}

function silenceElapsed(hours: number | null, lastActivityAt: string | null, now: Date): boolean {
  if (hours == null) return false;
  if (!lastActivityAt) return true;
  const last = Date.parse(lastActivityAt);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= hours * 60 * 60 * 1000;
}

function silenceHoursFromStored(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < SILENCE_HOUR_MIN || parsed > SILENCE_HOUR_MAX) return null;
  return parsed;
}

function parseSilenceField(value: unknown): { ok: true; hours: number | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, hours: null };
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, error: silenceError() };
  }
  const raw = String(value).trim();
  if (raw === '') return { ok: true, hours: null };
  if (!/^\d+$/.test(raw)) return { ok: false, error: silenceError() };
  const hours = Number(raw);
  if (!Number.isInteger(hours) || hours < SILENCE_HOUR_MIN || hours > SILENCE_HOUR_MAX) {
    return { ok: false, error: silenceError() };
  }
  return { ok: true, hours };
}

function silenceError(): string {
  return 'Silence hours are a whole number from 1 to 8760, or leave the field blank.';
}

import { SMS_OPT_OUT_LINE, SMS_OPT_OUT_LINE_MODES, SMS_OPT_OUT_LINE_MODE_LABELS, type SmsOptOutLineSetting } from '@/lib/sms/opt-out-line';
import type { SmsOptOutLinePersistence } from '@/lib/sms/settings-admin';

import { saveSmsOptOutLineSettingAction } from '@/app/admin/outreach/actions';

export function SmsOptOutLineSettingControl({
  setting,
  persistence,
  notice,
  from,
  to,
  saved,
  error,
}: {
  setting: SmsOptOutLineSetting;
  persistence: SmsOptOutLinePersistence;
  notice: string | null;
  from: string;
  to: string;
  saved: string | null;
  error: string | null;
}) {
  return (
    <article className="rounded-xl border border-slate-800 p-4">
      <h3 className="font-medium">Opt-out line</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Choose when outbound texts include “{SMS_OPT_OUT_LINE}”. Inbound STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, and “don’t text me” replies always stop texts to that number.
      </p>
      {saved === 'database' ? (
        <p className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">Saved.</p>
      ) : null}
      {saved === 'preview' ? (
        <p className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
          Saved for this preview. It stays on this server until the database is connected.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{error}</p>
      ) : null}
      {notice && saved !== 'preview' ? (
        <p className="mt-3 text-sm text-slate-400">{notice}</p>
      ) : null}
      <form action={saveSmsOptOutLineSettingAction} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={to} />
        <label className="text-xs text-slate-400">
          When to add the line
          <select
            name="mode"
            defaultValue={setting.mode}
            className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            {SMS_OPT_OUT_LINE_MODES.map((mode) => (
              <option key={mode} value={mode}>{SMS_OPT_OUT_LINE_MODE_LABELS[mode]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          After hours of silence
          <input
            name="silenceHours"
            type="number"
            min={1}
            max={8760}
            step={1}
            inputMode="numeric"
            defaultValue={setting.silenceHours ?? ''}
            placeholder="Off"
            className="mt-1 block w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">
          Save
        </button>
      </form>
      <p className="mt-3 max-w-3xl text-xs text-slate-500">
        {persistence === 'database'
          ? 'First text in each thread adds the line on the first outbound text, and again after the optional quiet stretch. Every text always adds it. Never leaves it off.'
          : 'First text in each thread is the safe default. A blank silence field leaves that extra rule off. Never leaves the line off, including after a quiet stretch.'}
      </p>
    </article>
  );
}

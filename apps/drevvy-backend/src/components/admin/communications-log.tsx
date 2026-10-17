import type { CommunicationRecord } from '@/lib/admin/communications';
import { when } from '@/lib/admin/format';
import type { TrafficFilter } from '@/lib/admin/outreach/types';

export function CommunicationsLog({
  rows,
  traffic,
  from,
  to,
  configured,
}: {
  rows: CommunicationRecord[];
  traffic: TrafficFilter;
  from: string;
  to: string;
  configured: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-800 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-medium">Stored messages and calls</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Full text and email copies, plus call transcripts and recordings saved from Telnyx. Test traffic stays out of the totals unless you show it here.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/admin/outreach">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <label className="text-xs text-slate-400">
            Traffic
            <select name="traffic" defaultValue={traffic} className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100">
              <option value="live">Live only</option>
              <option value="test">Test only</option>
              <option value="all">Live and test</option>
            </select>
          </label>
          <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Apply</button>
        </form>
      </div>
      {!configured ? (
        <p className="mt-4 text-sm text-slate-400">Storage is not configured in this environment, so saved messages are not loaded.</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No stored messages match this filter.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-100">
                  {label(row.direction)} · {channelLabel(row.channel)}
                  {row.touchpoint ? ` · ${row.touchpoint}` : ''}
                  {row.isTest ? <TestBadge /> : null}
                </p>
                <p className="text-xs text-slate-500">{when(row.occurredAt)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {row.from ?? 'Unknown sender'} → {row.to ?? 'Unknown recipient'}
                {row.status ? ` · ${row.status.replace(/_/g, ' ')}` : ''}
                {row.durationS != null ? ` · ${row.durationS}s` : ''}
                {row.dealId ? ` · deal ${row.dealId}` : ''}
              </p>
              <ResultChips row={row} />
              {row.body ? <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-200">{row.body}</pre> : null}
              {row.channel === 'call' || row.channel === 'voicemail' ? (
                <div className="mt-3 space-y-2">
                  {row.recordingPath ? (
                    <audio controls preload="none" src={`/api/admin/outreach/recordings?path=${encodeURIComponent(row.recordingPath)}`} className="w-full" />
                  ) : (
                    <p className="text-xs text-slate-500">Recording not stored yet.</p>
                  )}
                  {row.transcript && row.transcript !== row.body ? (
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-sans text-sm text-slate-300">{row.transcript}</pre>
                  ) : null}
                  {row.summary ? <p className="text-sm text-slate-400">{row.summary}</p> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function TestBadge() {
  return <span className="ml-2 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-100">TEST</span>;
}

function ResultChips({ row }: { row: CommunicationRecord }) {
  const chips = [
    row.textableNumber ? `Textable ${row.textableNumber}` : null,
    row.email ? `Email ${row.email}` : null,
    row.goalReached ? 'Goal reached' : null,
    row.voicemailLeft ? 'Voicemail left' : null,
  ].filter((chip): chip is string => Boolean(chip));
  if (chips.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">{chip}</span>
      ))}
    </div>
  );
}

function label(direction: CommunicationRecord['direction']): string {
  if (direction === 'inbound') return 'Inbound';
  if (direction === 'outbound') return 'Outbound';
  return 'Message';
}

function channelLabel(channel: CommunicationRecord['channel']): string {
  if (channel === 'sms') return 'Text';
  if (channel === 'email') return 'Email';
  if (channel === 'voicemail') return 'Voicemail';
  return 'Call';
}

import { TestBadge } from '@/components/admin/communications-log';
import { when } from '@/lib/admin/format';
import type { IdentityAdmin } from '@/lib/admin/identities';
import {
  addSmsPoolNumber,
  addVoiceNumber,
  releaseConversationNumber,
  reviewUnmatched,
  savePoolSettings,
} from '@/app/admin/outreach/actions';

export function ConversationIdentities({
  admin,
  traffic,
  from,
  to,
  notice,
}: {
  admin: IdentityAdmin;
  traffic: string;
  from: string;
  to: string;
  notice: string | null;
}) {
  return (
    <article className="rounded-xl border border-slate-800 p-4">
      <h3 className="font-medium">Conversation identities</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Each shopper, car, and dealer keeps one email alias and one text number. Voice numbers are caller ID only. The voice agent does not give that number out. It asks for a textable number or an email.
      </p>
      {notice ? <p className="mt-3 text-sm text-emerald-200">{notice}</p> : null}
      {!admin.configured ? (
        <p className="mt-4 text-sm text-slate-400">Identity storage is not configured in this environment.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {admin.livePool.low ? (
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              The live text pool is low ({admin.livePool.active} active, flag at {admin.livePool.watermark}). Purchase another Telnyx number.
            </p>
          ) : (
            <p className="text-sm text-slate-400">{admin.livePool.active} live text numbers are active.</p>
          )}
          <IdentityTable rows={admin.identities} from={from} to={to} traffic={traffic} />
          <UnmatchedList rows={admin.unmatched} from={from} to={to} traffic={traffic} />
          <div className="grid gap-4 lg:grid-cols-3">
            <PoolForm from={from} to={to} traffic={traffic} />
            <VoiceForm from={from} to={to} traffic={traffic} voices={admin.voices} />
            <SettingsForm from={from} to={to} traffic={traffic} cooldownDays={admin.cooldownDays} watermark={admin.watermark} />
          </div>
        </div>
      )}
    </article>
  );
}

function IdentityTable({
  rows,
  from,
  to,
  traffic,
}: {
  rows: IdentityAdmin['identities'];
  from: string;
  to: string;
  traffic: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">No conversation identities match this filter.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Dealer</th>
            <th className="py-2 pr-3 font-medium">Alias</th>
            <th className="py-2 pr-3 font-medium">Text number</th>
            <th className="py-2 pr-3 font-medium">Caller ID</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-800 align-top">
              <td className="py-2 pr-3">
                <p>{row.dealerId}</p>
                <p className="text-xs text-slate-500">{row.shopperFirstName} · deal {row.dealId}</p>
              </td>
              <td className="py-2 pr-3">
                <p>{row.emailAlias}</p>
                <p className="text-xs text-slate-500">From and reply use this alias. Display name is {row.shopperFirstName}.</p>
              </td>
              <td className="py-2 pr-3">{row.smsNumberE164}</td>
              <td className="py-2 pr-3">{row.voiceNumberE164 ?? 'None'}</td>
              <td className="py-2">
                {row.isTest ? <TestBadge /> : <span className="text-xs text-slate-400">Live</span>}
                {row.endedAt ? (
                  <p className="mt-1 text-xs text-slate-500">Released {when(row.endedAt)}</p>
                ) : (
                  <form action={releaseConversationNumber} className="mt-2">
                    <HiddenFilters from={from} to={to} traffic={traffic} />
                    <input type="hidden" name="dealId" value={row.dealId} />
                    <input type="hidden" name="dealerId" value={row.dealerId} />
                    <button type="submit" className="text-xs text-slate-300 underline">Release number</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnmatchedList({
  rows,
  from,
  to,
  traffic,
}: {
  rows: IdentityAdmin['unmatched'];
  from: string;
  to: string;
  traffic: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium">Unmatched inbound</h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No unmatched inbound messages are waiting for review.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  {row.channel} · {row.fromAddress ?? 'Unknown sender'} → {row.toAddress ?? 'Unknown recipient'}
                  {row.isTest ? <TestBadge /> : null}
                </p>
                <p className="text-xs text-slate-500">{when(row.receivedAt)}</p>
              </div>
              {row.body ? <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-200">{row.body}</pre> : null}
              <form action={reviewUnmatched} className="mt-2">
                <HiddenFilters from={from} to={to} traffic={traffic} />
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" className="text-xs text-emerald-300">Mark reviewed</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PoolForm({ from, to, traffic }: { from: string; to: string; traffic: string }) {
  return (
    <form action={addSmsPoolNumber} className="space-y-2 rounded-lg border border-slate-800 p-3">
      <h4 className="text-sm font-medium">Add a text number</h4>
      <HiddenFilters from={from} to={to} traffic={traffic} />
      <label className="block text-xs text-slate-400">
        Number
        <input name="phone" required className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" placeholder="+18035550148" />
      </label>
      <label className="block text-xs text-slate-400">
        Label
        <input name="label" required className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" name="isTest" value="1" />
        Test number
      </label>
      <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Add to pool</button>
    </form>
  );
}

function VoiceForm({
  from,
  to,
  traffic,
  voices,
}: {
  from: string;
  to: string;
  traffic: string;
  voices: IdentityAdmin['voices'];
}) {
  return (
    <form action={addVoiceNumber} className="space-y-2 rounded-lg border border-slate-800 p-3">
      <h4 className="text-sm font-medium">Add a state caller ID</h4>
      <HiddenFilters from={from} to={to} traffic={traffic} />
      <label className="block text-xs text-slate-400">
        State
        <input name="state" required maxLength={2} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" placeholder="SC" />
      </label>
      <label className="block text-xs text-slate-400">
        Number
        <input name="phone" required className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
      </label>
      <label className="block text-xs text-slate-400">
        Label
        <input name="label" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Save caller ID</button>
      {voices.length > 0 ? (
        <ul className="text-xs text-slate-400">
          {voices.map((voice) => (
            <li key={voice.state}>{voice.state} · {voice.phoneE164}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function SettingsForm({
  from,
  to,
  traffic,
  cooldownDays,
  watermark,
}: {
  from: string;
  to: string;
  traffic: string;
  cooldownDays: number;
  watermark: number;
}) {
  return (
    <form action={savePoolSettings} className="space-y-2 rounded-lg border border-slate-800 p-3">
      <h4 className="text-sm font-medium">Pool rules</h4>
      <p className="text-xs text-slate-500">A text number can be live at different dealers. The same dealer waits this many days before a different shopper uses it again.</p>
      <HiddenFilters from={from} to={to} traffic={traffic} />
      <label className="block text-xs text-slate-400">
        Cooldown days
        <input name="cooldownDays" required defaultValue={cooldownDays} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
      </label>
      <label className="block text-xs text-slate-400">
        Low-pool flag
        <input name="watermark" required defaultValue={watermark} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Save rules</button>
    </form>
  );
}

function HiddenFilters({ from, to, traffic }: { from: string; to: string; traffic: string }) {
  return (
    <>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="traffic" value={traffic} />
    </>
  );
}

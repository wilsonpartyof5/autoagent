import Link from 'next/link';
import type { ReactNode } from 'react';

import { ConversationTable } from '@/components/admin/outreach-dashboard';
import { loadConversations, parseOutreachRange, parseTrafficFilter } from '@/lib/admin/outreach/repository';
import { STOP_REASONS, TOUCHPOINT_IDS, VARIANTS, type StopReason, type TouchpointId, type Variant } from '@/lib/admin/outreach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach conversations | Drevvy Admin' };

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; touchpoint?: string; variant?: string; outcome?: string; q?: string; traffic?: string }>;
}) {
  const params = await searchParams;
  const range = parseOutreachRange(params.from, params.to);
  const traffic = parseTrafficFilter(params.traffic);
  const touchpoint = TOUCHPOINT_IDS.includes(params.touchpoint as TouchpointId) ? params.touchpoint as TouchpointId : '';
  const variant = VARIANTS.includes(params.variant as Variant) ? params.variant as Variant : '';
  const outcome = STOP_REASONS.includes(params.outcome as StopReason) ? params.outcome as StopReason : '';
  const deals = await loadConversations({ ...range, touchpoint, variant, outcome, q: params.q, traffic });

  return (
    <section className="space-y-6">
      <header>
        <Link href={`/admin/outreach?from=${range.from}&to=${range.to}&traffic=${traffic}`} className="text-sm text-emerald-300">Outreach</Link>
        <h2 className="mt-2 text-2xl font-semibold">Conversations</h2>
        <p className="mt-1 text-sm text-slate-400">Dealer names are visible here. Shoppers still only see their own side of a deal.</p>
      </header>
      <form className="flex flex-wrap items-end gap-2" action="/admin/outreach/conversations">
        <input type="hidden" name="from" value={range.from} />
        <input type="hidden" name="to" value={range.to} />
        <Field label="Traffic">
          <select name="traffic" defaultValue={traffic} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
            <option value="live">Live only</option>
            <option value="test">Test only</option>
            <option value="all">Live and test</option>
          </select>
        </Field>
        <Field label="Touchpoint">
          <select name="touchpoint" defaultValue={touchpoint} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
            <option value="">Any</option>
            {TOUCHPOINT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </Field>
        <Field label="Variant">
          <select name="variant" defaultValue={variant} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
            <option value="">Any</option>
            {VARIANTS.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </Field>
        <Field label="Outcome">
          <select name="outcome" defaultValue={outcome} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
            <option value="">Any</option>
            {STOP_REASONS.map((id) => <option key={id} value={id}>{id.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>
        <Field label="Search">
          <input name="q" defaultValue={params.q ?? ''} placeholder="Dealer, buyer, stock" className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
        </Field>
        <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Filter</button>
      </form>
      <p className="text-sm text-slate-400">{deals.length} threads</p>
      <ConversationTable deals={deals} />
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

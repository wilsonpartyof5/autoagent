import Link from 'next/link';
import { notFound } from 'next/navigation';

import { loadIdentitiesForDeal } from '@/lib/admin/identities';
import { channelLabel, outcomeLabel, stopLabel } from '@/lib/admin/outreach/analytics';
import { when } from '@/lib/admin/format';
import { loadConversation } from '@/lib/admin/outreach/repository';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await loadConversation(dealId);
  return { title: deal ? `${deal.dealerName} | Outreach` : 'Outreach | Drevvy Admin' };
}

export default async function ConversationPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const [deal, identities] = await Promise.all([loadConversation(dealId), loadIdentitiesForDeal(dealId)]);
  if (!deal) notFound();

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin/outreach/conversations" className="text-sm text-emerald-300">Conversations</Link>
        <h2 className="mt-2 text-2xl font-semibold">{deal.dealerName}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {deal.dealerType} · {deal.brand} · {deal.region} · {deal.dealerSize}. Calling for {deal.shopperFirst} on the {deal.vehicle}, stock #{deal.stock}.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {stopLabel(deal.stop)}{deal.otdReceived ? ' · OTD received' : ''}
          {deal.isTest ? <span className="ml-2 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-100">TEST</span> : null}
        </p>
        {identities.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            {identities.map((identity) => (
              <li key={identity.id}>
                {identity.dealerId} · {identity.aliasDomain} · {identity.emailAlias} · {identity.smsNumberE164}
                {identity.voiceNumberE164 ? ` · caller ID ${identity.voiceNumberE164}` : ''}
                {identity.isTest ? ' · TEST' : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      <ol className="space-y-3">
        {deal.events.map((event) => (
          <li key={event.id} className={`rounded-xl border p-4 ${event.direction === 'inbound' ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-slate-800'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                {event.direction === 'inbound' ? 'Inbound' : 'Outbound'} · {event.touchpoint} {event.variant} · {channelLabel(event.channel)}
              </p>
              <p className="text-xs text-slate-500">{when(event.sentAt)} · {event.dealerLocalTime.slice(0, 16).replace('T', ' ')} {event.dealerTz}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {event.status.replace(/_/g, ' ')} · {event.toType.replace(/_/g, ' ')}
              {event.callOutcome ? ` · ${outcomeLabel(event.callOutcome)}` : ''}
              {event.callDurationS != null ? ` · ${event.callDurationS}s` : ''}
              {event.optOut ? ' · opt-out' : ''}
              {event.capturedNumber ? ` · ${event.capturedNumber}` : ''}
              {event.isTest ? ' · TEST' : ''}
            </p>
            {(event.fromAddress || event.toAddress) ? (
              <p className="mt-1 text-xs text-slate-500">{event.fromAddress ?? 'Unknown sender'} → {event.toAddress ?? 'Unknown recipient'}</p>
            ) : null}
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-200">{event.body}</pre>
            {event.recordingPath ? (
              <audio controls preload="none" src={`/api/admin/outreach/recordings?path=${encodeURIComponent(event.recordingPath)}`} className="mt-3 w-full" />
            ) : null}
            {event.transcript && event.transcript !== event.body ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-sans text-sm text-slate-300">{event.transcript}</pre>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

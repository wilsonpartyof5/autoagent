import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StageChip } from '@/components/admin/admin-shell';
import { OfferTrend } from '@/components/admin/offer-trend';
import { stageLabel, usd, when } from '@/lib/admin/format';
import { loadDeal } from '@/lib/admin/repository';
import { DEAL_STAGES } from '@/lib/admin/types';

export const metadata = { title: 'Deal | Drevvy Admin' };

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string; dealId: string }>;
}) {
  const { id, dealId } = await params;
  const loaded = await loadDeal(dealId);
  if (!loaded || loaded.shopper.id !== id) notFound();
  const { shopper, deal, card } = loaded;
  const responded = deal.dealers.filter((dealer) => dealer.responded).length;

  return (
    <section className="space-y-6">
      <Link href={`/admin/shoppers/${shopper.id}`} className="text-sm text-emerald-300 hover:underline">{shopper.name}</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{card.title}</h2>
          <p className="text-sm text-slate-400">{card.trim} · VIN {deal.vehicle.vin} · {card.city}, {card.state}</p>
        </div>
        <StageChip label={stageLabel(deal.stage)} />
      </header>

      <ol className="flex flex-wrap gap-2 text-xs">
        {DEAL_STAGES.map((stage) => (
          <li key={stage} className={stage === deal.stage ? 'rounded-full bg-emerald-400 px-3 py-1 font-medium text-slate-950' : 'rounded-full bg-slate-800 px-3 py-1 text-slate-300'}>
            {stageLabel(stage)}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-medium">What {shopper.name.split(' ')[0]} sees</h3>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Starting price" value={usd(card.listedPrice)} />
            <Stat label="Best OTD" value={usd(card.bestOtd)} />
            <Stat label="Savings vs listed" value={card.savings == null ? '—' : usd(card.savings)} />
          </dl>
          <p className="text-sm text-slate-300">{card.contacted} dealerships contacted · {card.responded} responded</p>
          <p className="text-sm text-slate-400">SMS {card.channelSent.sms} · Email {card.channelSent.email} · Voice {card.channelSent.voice}</p>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">SMS summary</h4>
            <p className="mt-1 text-sm">{deal.smsSummary}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">Email summary</h4>
            <p className="mt-1 text-sm">{deal.emailSummary}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">Activity</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {deal.shopperTimeline.map((event) => (
                <li key={`${event.at}-${event.label}`}>
                  <span className="text-slate-500">{when(event.at)}</span> {event.label}. {event.detail}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">OTD breakdown</h4>
            <Breakdown otd={deal.otd} />
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">Offer trend</h4>
            <OfferTrend points={card.offers} />
          </div>
          <p className="text-sm text-emerald-200">Next: {deal.nextStep}</p>
        </article>

        <article className="space-y-4 rounded-xl border border-amber-900/60 bg-slate-900 p-4">
          <h3 className="font-medium text-amber-100">Admin only</h3>
          <p className="text-sm text-slate-400">{responded} of {deal.dealers.length} stores responded. LLM cost on this deal {usd(deal.llmCostUsd)}.</p>
          <div className="space-y-3">
            {deal.dealers.map((dealer) => (
              <div key={dealer.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{dealer.name}</p>
                  <span className="text-xs text-slate-400">{dealer.responded ? 'Replied' : 'Waiting'}</span>
                </div>
                <p className="text-slate-400">{dealer.city}, {dealer.state} · {dealer.phone} · {dealer.email}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {dealer.cadence.map((step) => (
                    <li key={`${dealer.id}-${step.day}-${step.channel}`}>Day {step.day} {step.channel}: {step.label} ({step.status})</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">Raw transcripts</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {deal.transcripts.map((message) => (
                <li key={message.id} className="rounded-md bg-slate-950 px-3 py-2">
                  <p className="text-xs text-slate-500">{when(message.at)} · {message.channel} · {message.direction} · {message.dealerName}</p>
                  <p>{message.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">Agent decisions</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {deal.decisions.map((decision) => (
                <li key={`${decision.at}-${decision.action}`}>
                  <span className="text-slate-500">{decision.action}</span> — {decision.note}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">Full timeline</h4>
            <ul className="mt-2 space-y-1 text-sm">
              {deal.adminTimeline.map((event) => (
                <li key={`${event.at}-${event.label}`}>{when(event.at)} · {event.label} · {event.detail}</li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <article className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium">MarketCheck leverage</h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{deal.market.source === 'live' ? 'Live MarketCheck' : 'Mock market data'}</p>
        <p className="mt-2 text-sm text-emerald-100">{deal.market.citation}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <Stat label="Days on market" value={String(deal.market.daysOnMarket)} />
          <Stat label="Price drops" value={String(deal.market.priceDropCount)} />
          <Stat label="Comps within 50mi" value={String(deal.market.comparableCount)} />
          <Stat label="Leverage score" value={String(deal.market.leverageScore)} />
        </dl>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {deal.market.comps.map((comp) => (
            <li key={`${comp.price}-${comp.distanceMiles}`}>{comp.label} · {usd(comp.price)} · {comp.distanceMiles}mi · {comp.daysOnMarket} days</li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Breakdown({ otd }: { otd: { listedPrice: number; negotiatedPrice: number | null; docFee: number; tax: number; title: number; registration: number; otd: number | null } }) {
  const rows = [
    ['Listed price', usd(otd.listedPrice)],
    ['Final price', usd(otd.negotiatedPrice)],
    ['Doc fee', usd(otd.docFee)],
    ['Est. tax', otd.negotiatedPrice == null ? '—' : usd(otd.tax)],
    ['Title', usd(otd.title)],
    ['Registration', usd(otd.registration)],
    ['Out the door', usd(otd.otd)],
  ];
  return (
    <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2 border-b border-slate-800 py-1">
          <dt className="text-slate-400">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

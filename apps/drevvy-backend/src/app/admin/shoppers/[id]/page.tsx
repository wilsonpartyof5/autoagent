import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StageChip } from '@/components/admin/admin-shell';
import { stageLabel, subscriptionLabel, usd, when } from '@/lib/admin/format';
import { loadShopper } from '@/lib/admin/repository';

export const metadata = { title: 'Shopper | Drevvy Admin' };

export default async function ShopperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadShopper(id);
  if (!loaded) notFound();
  const { shopper, cards } = loaded;

  return (
    <section className="space-y-6">
      <Link href="/admin" className="text-sm text-emerald-300 hover:underline">All shoppers</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{shopper.name}</h2>
          <p className="text-sm text-slate-400">{shopper.email}</p>
        </div>
        <div className="text-right text-sm text-slate-300">
          <div>{subscriptionLabel(shopper.subscription)}{shopper.purchasedPack ? ` · ${shopper.purchasedPack}-key pack` : ''}</div>
          <div>{cards.length} {cards.length === 1 ? 'deal' : 'deals'}</div>
          <div className="text-slate-500">Joined {when(shopper.signedUpAt)}</div>
        </div>
      </header>
      <p className="text-sm text-slate-400">These cards match the shopper&apos;s Deals tab. Dealer names, transcripts, and cadence are on each deal.</p>
      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-400">No cars with the agent yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.id} href={`/admin/shoppers/${shopper.id}/deals/${card.id}`} className="rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-emerald-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{card.title}</h3>
                  <p className="text-sm text-slate-400">{card.trim} · {card.condition} · {card.city}, {card.state}</p>
                </div>
                <StageChip label={stageLabel(card.stage)} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Starting price</dt>
                  <dd>{usd(card.listedPrice)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Best OTD</dt>
                  <dd>{usd(card.bestOtd)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Savings</dt>
                  <dd>{card.savings == null ? '—' : `${usd(card.savings)} (${((card.savingsPct ?? 0) * 100).toFixed(1)}%)`}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-400">{card.lastActivityLabel} · {when(card.lastActivityAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

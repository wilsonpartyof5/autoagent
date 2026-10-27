import Link from 'next/link';
import { StageChip } from '@/components/admin/admin-shell';
import { DEMO_TEAM } from '@/lib/dealer/demo-org';
import { stageLabel, subscriptionLabel, usd, when } from '@/lib/admin/format';
import { queryShoppers, type ShopperSort } from '@/lib/admin/repository';
import { DEAL_STAGES, type DealStage } from '@/lib/admin/types';

export const metadata = { title: 'Shoppers | Drevvy Admin' };

const sorts: Array<{ key: ShopperSort; label: string }> = [
  { key: 'name', label: 'Shopper' },
  { key: 'signedUp', label: 'Signed up' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'cars', label: 'Cars' },
  { key: 'savings', label: 'Savings' },
  { key: 'lastActivity', label: 'Last activity' },
];

export default async function AdminShoppersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: ShopperSort; dir?: 'asc' | 'desc' }>;
}) {
  const params = await searchParams;
  const sort = sorts.some((item) => item.key === params.sort) ? params.sort : 'lastActivity';
  const dir = params.dir === 'asc' ? 'asc' : 'desc';
  const rows = await queryShoppers({ q: params.q, sort, dir });
  const nextDir = dir === 'asc' ? 'desc' : 'asc';

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mut">{rows.length} shoppers in the mock book. Dealer staff sit in the same directory. Shopper keys stay off this desk.</p>
        </div>
        <form className="flex gap-2" action="/admin">
          <input type="hidden" name="sort" value={sort ?? 'lastActivity'} />
          <input type="hidden" name="dir" value={dir} />
          <label className="sr-only" htmlFor="shopper-search">Search shoppers</label>
          <input
            id="shopper-search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search name, email, or car"
            className="w-64 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950" type="submit">Search</button>
        </form>
      </header>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {sorts.map((column) => (
                <th key={column.key} className="px-3 py-3 font-medium">
                  <Link href={`/admin?q=${encodeURIComponent(params.q ?? '')}&sort=${column.key}&dir=${sort === column.key ? nextDir : 'desc'}`}>
                    {column.label}
                  </Link>
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Stages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((shopper) => (
              <tr key={shopper.id} className="border-t border-slate-800">
                <td className="px-3 py-3">
                  <Link href={`/admin/shoppers/${shopper.id}`} className="font-medium text-emerald-200 hover:underline">{shopper.name}</Link>
                  <div className="text-xs text-slate-500">{shopper.email}</div>
                </td>
                <td className="px-3 py-3">{when(shopper.signedUpAt)}</td>
                <td className="px-3 py-3">{subscriptionLabel(shopper.subscription)}</td>
                <td className="px-3 py-3">{shopper.cars}/{shopper.carCap}</td>
                <td className="px-3 py-3">{usd(shopper.totalSavings)}</td>
                <td className="px-3 py-3">{when(shopper.lastActivityAt)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {DEAL_STAGES.filter((stage) => shopper.stageCounts[stage] > 0).map((stage) => (
                      <StageCount key={stage} stage={stage} count={shopper.stageCounts[stage]} />
                    ))}
                    {shopper.cars === 0 ? <span className="text-slate-500">No cars yet</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Sorted by {sort} ({dir}). Times are Eastern.</p>
      <div className="g card">
        <div className="t">Dealer staff</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Detail</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_TEAM.map(person => (
              <tr key={person.name}>
                <td>{person.name}</td>
                <td>Dealer · {person.role}</td>
                <td>{person.rooftops}</td>
                <td>{person.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StageCount({ stage, count }: { stage: DealStage; count: number }) {
  return <StageChip label={`${count} ${stageLabel(stage)}`} />;
}

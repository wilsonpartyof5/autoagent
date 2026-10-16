import { savePlatformBill } from './actions';
import {
  buildMonthComparison,
  DEALER_CALLS_PER_CAR,
  MARKETCHECK_STANDARD_MONTHLY_USD,
  VARIABLE_COST_PER_CAR_USD,
} from '@/lib/admin/costs';
import { loadDealsOverview } from '@/lib/admin/deals-overview-store';
import { dollars, monthLabel, when } from '@/lib/admin/format';
import { listPlatformBills } from '@/lib/admin/platform-bills';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Costs | Drevvy Admin' };

export default async function AdminCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; service?: string; month?: string; amount?: string; note?: string }>;
}) {
  const params = await searchParams;
  const [{ bills, unavailable }, overview] = await Promise.all([
    listPlatformBills(),
    loadDealsOverview(),
  ]);
  const months = buildMonthComparison(bills, overview.carsByMonth);
  const overMonths = new Set(months.filter((month) => month.over).map((month) => month.month));
  const carSource = overview.source === 'live' ? 'live deals' : 'the demo book, because the deal tables are empty';

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold">Costs</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Record each platform bill in dollars. Expectation for a month is MarketCheck Standard at {dollars(MARKETCHECK_STANDARD_MONTHLY_USD)}, plus {dollars(VARIABLE_COST_PER_CAR_USD)} of variable cost per car. The variable figure assumes {DEALER_CALLS_PER_CAR} dealer calls per car. A month is flagged when recorded bills run over that expectation. Car counts come from {carSource}.
        </p>
      </header>

      {params.saved === '1' ? (
        <p className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">Bill saved.</p>
      ) : null}
      {params.error ? (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{params.error}</p>
      ) : null}
      {unavailable ? (
        <p className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">{unavailable}</p>
      ) : null}

      <article className="grid gap-3 sm:grid-cols-3">
        <Assumption label="MarketCheck Standard" value={`${dollars(MARKETCHECK_STANDARD_MONTHLY_USD)} / month`} />
        <Assumption label="Dealer calls" value={`${DEALER_CALLS_PER_CAR} per car`} />
        <Assumption label="Variable cost" value={`${dollars(VARIABLE_COST_PER_CAR_USD)} per car`} />
      </article>

      <form action={savePlatformBill} className="space-y-3">
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 font-medium">Service</th>
                <th className="px-3 py-3 font-medium">Month</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Note</th>
                <th className="px-3 py-3 font-medium">Saved</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t border-slate-800">
                  <td className="px-3 py-3 font-medium">{bill.service}</td>
                  <td className="px-3 py-3">
                    {monthLabel(bill.month)}
                    {overMonths.has(bill.month) ? <Flag /> : null}
                  </td>
                  <td className="px-3 py-3">{dollars(bill.amountUsd)}</td>
                  <td className="px-3 py-3 text-slate-300">{bill.note || '—'}</td>
                  <td className="px-3 py-3 text-slate-400">{when(bill.createdAt)}</td>
                </tr>
              ))}
              {bills.length === 0 ? (
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>No platform bills saved yet.</td>
                </tr>
              ) : null}
              <tr className="border-t border-slate-800 bg-slate-900/40">
                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor="bill-service">Service</label>
                  <input
                    id="bill-service"
                    name="service"
                    required
                    maxLength={80}
                    defaultValue={params.service ?? ''}
                    placeholder="MarketCheck"
                    className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor="bill-month">Month</label>
                  <input
                    id="bill-month"
                    name="month"
                    type="month"
                    required
                    defaultValue={params.month ?? ''}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor="bill-amount">Amount in dollars</label>
                  <input
                    id="bill-amount"
                    name="amount"
                    inputMode="decimal"
                    required
                    min={0}
                    max={1000000}
                    step="0.01"
                    defaultValue={params.amount ?? ''}
                    placeholder="749.00"
                    className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor="bill-note">Note</label>
                  <input
                    id="bill-note"
                    name="note"
                    maxLength={500}
                    defaultValue={params.note ?? ''}
                    placeholder="Standard plan"
                    className="w-full min-w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-3">
                  <button type="submit" className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950">Save</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>

      <article className="space-y-3">
        <h3 className="font-medium">Month versus expectation</h3>
        <p className="text-sm text-slate-400">
          Expected = {dollars(MARKETCHECK_STANDARD_MONTHLY_USD)} + cars × {dollars(VARIABLE_COST_PER_CAR_USD)}. The call assumption is {DEALER_CALLS_PER_CAR} dealer calls per car.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 font-medium">Month</th>
                <th className="px-3 py-3 font-medium">Cars</th>
                <th className="px-3 py-3 font-medium">MarketCheck</th>
                <th className="px-3 py-3 font-medium">Variable</th>
                <th className="px-3 py-3 font-medium">Expected</th>
                <th className="px-3 py-3 font-medium">Actual</th>
                <th className="px-3 py-3 font-medium">Difference</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.month} className="border-t border-slate-800">
                  <td className="px-3 py-3">{monthLabel(month.month)}</td>
                  <td className="px-3 py-3">{month.cars}</td>
                  <td className="px-3 py-3">{dollars(month.fixedUsd)}</td>
                  <td className="px-3 py-3">{dollars(month.variableUsd)}</td>
                  <td className="px-3 py-3">{dollars(month.expectedUsd)}</td>
                  <td className="px-3 py-3">{month.recorded ? dollars(month.actualUsd) : '—'}</td>
                  <td className="px-3 py-3">{month.recorded ? dollars(month.actualUsd - month.expectedUsd) : '—'}</td>
                  <td className="px-3 py-3">
                    {month.over ? <Flag /> : <span className="text-slate-400">{month.recorded ? 'Within expectation' : 'No bills yet'}</span>}
                  </td>
                </tr>
              ))}
              {months.length === 0 ? (
                <tr className="border-t border-slate-800">
                  <td className="px-3 py-3 text-slate-500" colSpan={8}>No months to compare yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function Assumption({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </article>
  );
}

function Flag() {
  return (
    <span className="ml-2 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-200">
      Over expectation
    </span>
  );
}

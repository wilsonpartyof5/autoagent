import type { CallEmailDealer } from '@/lib/admin/call-email-only';

export function CallEmailOnlyPanel({
  configured,
  dealers,
}: {
  configured: boolean;
  dealers: CallEmailDealer[];
}) {
  return (
    <article className="rounded-xl border border-slate-800 p-4">
      <h3 className="font-medium">Call / email only</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        These dealers repeatedly failed to open a lead form. The widget channel is skipped. Call and email still go out.
      </p>
      {!configured ? (
        <p className="mt-4 text-sm text-slate-400">Directory storage is not configured in this environment.</p>
      ) : dealers.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No dealers are marked call / email only.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Dealer</th>
                <th className="py-2 pr-3">Site</th>
                <th className="py-2">Vendor</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((dealer) => (
                <tr key={dealer.siteUrl} className="border-t border-slate-800">
                  <td className="py-2 pr-3">{dealer.name ?? 'Unnamed dealer'}</td>
                  <td className="py-2 pr-3 text-slate-300">{dealer.siteUrl}</td>
                  <td className="py-2">{dealer.widgetVendor ?? 'unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform-admin';
import { decryptToJson, isDecryptedLead } from '@/lib/crypto';
import { routePlatformLead } from './actions';

export const dynamic = 'force-dynamic';

export default async function NationwideLeadsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [{ data: leads, error }, { data: dealerships }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, dealer_id, vehicle_id, vin, enc_payload, created_at, status, routing_status, inventory_source, vehicle_snapshot, flow_id')
      .eq('routing_status', 'platform_inbox')
      .order('created_at', { ascending: false })
      .limit(250),
    supabase
      .from('dealerships')
      .select('id, name, marketcheck_dealer_id')
      .not('marketcheck_dealer_id', 'is', null)
      .order('name'),
  ]);

  const rows = await Promise.all(
    (leads ?? []).map(async (lead) => {
      try {
        const decrypted = await decryptToJson(lead.enc_payload);
        return { ...lead, contact: isDecryptedLead(decrypted) ? decrypted.user : null };
      } catch {
        return { ...lead, contact: null };
      }
    }),
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Nationwide Lead Inbox</h1>
        <p className="text-sm text-muted-foreground">MarketCheck leads waiting for a dealership to be onboarded or assigned.</p>
      </header>
      {error && <div className="rounded border border-destructive p-4 text-destructive">Unable to load leads: {error.message}</div>}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr><th className="p-3">Created</th><th className="p-3">Vehicle</th><th className="p-3">Dealer</th><th className="p-3">Contact</th><th className="p-3">Flow</th><th className="p-3">Assign</th></tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const snapshot = (lead.vehicle_snapshot ?? {}) as any;
              const identity = snapshot.baseIdentity ?? {};
              const dealer = snapshot.location?.dealer ?? {};
              return (
                <tr key={lead.id} className="border-t align-top">
                  <td className="p-3">{new Date(lead.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <strong>{[identity.year, identity.make, identity.model, identity.trim].filter(Boolean).join(' ') || lead.vehicle_id}</strong>
                    <div className="text-xs text-muted-foreground">{lead.vin}</div>
                  </td>
                  <td className="p-3">{dealer.name ?? lead.dealer_id ?? 'Unassigned'}</td>
                  <td className="p-3">
                    {lead.contact ? <><div>{lead.contact.name}</div><div>{lead.contact.email}</div><div>{lead.contact.phone ?? ''}</div></> : 'Encrypted'}
                  </td>
                  <td className="max-w-40 break-all p-3 font-mono text-xs">{lead.flow_id ?? '—'}</td>
                  <td className="p-3">
                    <form action={routePlatformLead} className="flex gap-2">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <select name="dealerId" required className="rounded border bg-background px-2 py-1">
                        <option value="">Select dealer</option>
                        {(dealerships ?? []).map((dealership) => (
                          <option key={dealership.id} value={dealership.id}>{dealership.name}</option>
                        ))}
                      </select>
                      <button className="rounded bg-primary px-3 py-1 text-primary-foreground" type="submit">Route</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform-admin';

export const dynamic = 'force-dynamic';

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const mcpUrl = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL;
  const healthPromise = mcpUrl
    ? fetch(`${mcpUrl.replace(/\/+$/, '')}/health`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null)
    : Promise.resolve(null);
  const [{ data: events }, { count: inboxLeads }, { count: sessions }, health] =
    await Promise.all([
      supabase
        .from('app_events')
        .select('flow_id, event_name, source, provider, status, error_code, duration_ms, result_count, payload, occurred_at')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(1000),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('routing_status', 'platform_inbox'),
      supabase
        .from('app_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', since),
      healthPromise,
    ]);

  const rows = events ?? [];
  const searches = rows.filter((event) => event.event_name === 'search.succeeded');
  const failures = rows.filter((event) => Boolean(event.error_code));
  const leads = rows.filter((event) => event.event_name === 'lead.submitted');
  const hydrationEvents = rows.filter((event) => event.event_name.startsWith('widget.hydrate:'));
  const imageLoads = rows.filter((event) => event.event_name === 'widget.image:loaded');
  const imageErrors = rows.filter((event) => event.event_name === 'widget.image:error');
  const recentDiagnostics = rows.filter((event) =>
    event.event_name.startsWith('widget.') ||
    event.event_name === 'provider.canary' ||
    event.event_name === 'search.fallback'
  );
  const latencies = searches
    .map((event) => event.duration_ms)
    .filter((value): value is number => typeof value === 'number');
  const averageLatency = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : 0;

  const cards = [
    ['ChatGPT sessions', sessions ?? 0],
    ['Successful searches', searches.length],
    ['Nationwide inbox leads', inboxLeads ?? 0],
    ['Search-to-lead', searches.length ? `${((leads.length / searches.length) * 100).toFixed(1)}%` : '—'],
    ['MarketCheck avg latency', averageLatency ? `${averageLatency} ms` : '—'],
    ['Recent provider errors', failures.length],
    ['Active inventory provider', health?.inventoryProvider ?? 'unknown'],
    ['MCP deployed commit', health?.commit ?? 'unknown'],
    ['MarketCheck schema', health?.marketcheckMcp?.schemaFingerprint ?? 'pending canary'],
    ['Widget hydration events', hydrationEvents.length],
    ['Image hosts loaded', imageLoads.length],
    ['Image load errors', imageErrors.length],
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">Nationwide ChatGPT activity and provider diagnostics for the last 30 days.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Recent failures</h2>
        <div className="mt-3 space-y-2 text-sm">
          {failures.slice(0, 20).map((event, index) => (
            <div key={`${event.occurred_at}-${index}`} className="flex justify-between border-b py-2">
              <span>{event.event_name} · {event.provider ?? 'unknown'}</span>
              <span className="text-destructive">{event.error_code}</span>
            </div>
          ))}
          {!failures.length && <p className="text-muted-foreground">No provider errors recorded.</p>}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">Widget and provider diagnostics</h2>
          <p className="text-sm text-muted-foreground">Latest bridge, hydration, image, canary, and fallback events.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Event</th>
                <th className="p-3">Status</th>
                <th className="p-3">Flow</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {recentDiagnostics.slice(0, 100).map((event, index) => (
                <tr key={`${event.occurred_at}-${index}`} className="border-t align-top">
                  <td className="whitespace-nowrap p-3">{new Date(event.occurred_at).toLocaleString()}</td>
                  <td className="p-3 font-medium">{event.event_name}</td>
                  <td className="p-3">
                    <span className={event.error_code ? 'text-destructive' : 'text-primary'}>
                      {event.error_code ?? event.status ?? 'recorded'}
                    </span>
                  </td>
                  <td className="max-w-40 break-all p-3 font-mono text-xs">{event.flow_id}</td>
                  <td className="max-w-md p-3 font-mono text-xs">
                    {event.payload && Object.keys(event.payload).length
                      ? JSON.stringify(event.payload)
                      : '—'}
                  </td>
                </tr>
              ))}
              {!recentDiagnostics.length && (
                <tr><td colSpan={5} className="p-5 text-muted-foreground">No widget diagnostics recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

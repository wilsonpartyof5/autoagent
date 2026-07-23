import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform-admin';

export const dynamic = 'force-dynamic';

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: events }, { count: inboxLeads }, { count: sessions }] =
    await Promise.all([
      supabase
        .from('app_events')
        .select('event_name, provider, status, error_code, duration_ms, result_count, occurred_at')
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
    ]);

  const rows = events ?? [];
  const searches = rows.filter((event) => event.event_name === 'search.succeeded');
  const failures = rows.filter((event) => Boolean(event.error_code));
  const leads = rows.filter((event) => event.event_name === 'lead.submitted');
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
    </section>
  );
}

import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform-admin';

export const dynamic = 'force-dynamic';

export default async function SessionTimelinePage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  await requirePlatformAdmin();
  const { flowId } = await params;
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('app_events')
    .select('id, event_name, source, provider, request_id, tool_name, dealer_id, vehicle_id, status, error_code, duration_ms, result_count, payload, occurred_at')
    .eq('flow_id', flowId)
    .order('occurred_at', { ascending: true });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Session Timeline</h1>
        <p className="break-all font-mono text-xs text-muted-foreground">{flowId}</p>
      </header>
      <ol className="space-y-3">
        {(events ?? []).map((event) => (
          <li key={event.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{event.event_name}</strong>
              <time className="text-xs text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</time>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.source} · {event.provider ?? 'no provider'} · {event.status ?? 'recorded'}
              {event.duration_ms !== null ? ` · ${event.duration_ms} ms` : ''}
            </p>
            {event.error_code && <p className="mt-2 text-sm text-destructive">{event.error_code}</p>}
            {event.payload && Object.keys(event.payload).length > 0 && (
              <pre className="mt-3 overflow-auto rounded bg-muted/40 p-3 text-xs">{JSON.stringify(event.payload, null, 2)}</pre>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform-admin';

export const dynamic = 'force-dynamic';

export default async function AppSessionsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from('app_sessions')
    .select('id, provider, started_at, last_activity_at, search_location, result_count, lead_id')
    .order('last_activity_at', { ascending: false })
    .limit(200);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ChatGPT App Sessions</h1>
        <p className="text-sm text-muted-foreground">PII-safe timelines for search, browsing, and lead activity.</p>
      </header>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr><th className="p-3">Started</th><th className="p-3">Location</th><th className="p-3">Provider</th><th className="p-3">Results</th><th className="p-3">Flow</th></tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((session) => (
              <tr key={session.id} className="border-t">
                <td className="p-3">{new Date(session.started_at).toLocaleString()}</td>
                <td className="p-3">{session.search_location ?? '—'}</td>
                <td className="p-3">{session.provider ?? '—'}</td>
                <td className="p-3">{session.result_count ?? '—'}</td>
                <td className="p-3"><Link className="text-primary underline" href={`/app/admin/sessions/${encodeURIComponent(session.id)}`}>View timeline</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const LOCAL_BEARER = /^local:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

let localClient: SupabaseClient | null = null;

/**
 * Disposable local database switch. Ignored when NODE_ENV is production,
 * Production, or empty. It never opens a hosted project.
 */
export function localDealerDatabaseEnabled(
  env: { NODE_ENV?: string; DREVYY_LOCAL_PG?: string } = process.env,
): boolean {
  const nodeEnv = (env.NODE_ENV ?? '').trim().toLowerCase();
  if (!nodeEnv || nodeEnv === 'production') return false;
  return env.DREVYY_LOCAL_PG === '1';
}

export function bindLocalAdminClient(client: SupabaseClient | null): void {
  if (client && !localDealerDatabaseEnabled()) {
    throw new Error('Local admin client is refused unless DREVYY_LOCAL_PG=1 outside production');
  }
  localClient = client;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Service-role client, or the bound disposable local client when that switch is on. */
export function appAdminClient(): SupabaseClient {
  if (localDealerDatabaseEnabled()) {
    if (!localClient) throw new Error('Local dealer database is not bound');
    return localClient;
  }
  return createAdminClient();
}

export async function readLocalAuthUser(
  authorization: string | null,
): Promise<{ id: string; email: string } | null> {
  if (!localDealerDatabaseEnabled()) return null;
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? '';
  const id = LOCAL_BEARER.exec(token)?.[1];
  if (!id) return null;
  try {
    const loaded = await appAdminClient()
      .from('auth.users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();
    if (loaded.error || !loaded.data) return null;
    const row = loaded.data as { id?: unknown; email?: unknown };
    if (row.id !== id || typeof row.email !== 'string' || !row.email.includes('@')) return null;
    return { id, email: row.email };
  } catch {
    return null;
  }
}

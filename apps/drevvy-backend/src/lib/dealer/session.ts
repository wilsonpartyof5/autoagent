import { createClient as createJwtClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const DEALER_ROLES = ['salesperson', 'bdc', 'sales_manager', 'owner_gm'] as const;
export type DealerRole = (typeof DEALER_ROLES)[number];

export type DealerRooftop = {
  id: string;
  name: string;
  role: DealerRole;
};

export type DealerSession = {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  role: DealerRole;
  rooftops: DealerRooftop[];
  canSwitchAllRooftops: boolean;
};

export class DealerAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'DealerAuthError';
  }
}

export function dealerPreviewEnabled(
  env: { NODE_ENV?: string; ADMIN_PREVIEW?: string; DEALER_PREVIEW?: string } = process.env,
): boolean {
  return env.NODE_ENV !== 'production'
    && (env.DEALER_PREVIEW === '1' || env.ADMIN_PREVIEW === '1');
}

export function mapDealerRole(raw: string | null | undefined): DealerRole {
  const value = (raw ?? '').trim().toLowerCase().replace(/[\s/-]+/g, '_');
  if (value === 'owner' || value === 'gm' || value === 'owner_gm' || value === 'general_manager') {
    return 'owner_gm';
  }
  if (value === 'sales_manager' || value === 'manager') return 'sales_manager';
  if (value === 'bdc') return 'bdc';
  return 'salesperson';
}

export function highestDealerRole(roles: readonly DealerRole[]): DealerRole {
  for (const role of ['owner_gm', 'sales_manager', 'bdc', 'salesperson'] as const) {
    if (roles.includes(role)) return role;
  }
  return 'salesperson';
}

export function dealerDisplayName(email: string | null | undefined, fallback = 'Dealer'): string {
  const local = (email ?? '').split('@')[0]?.trim() ?? '';
  if (!local) return fallback;
  const token = local.split(/[._-]/)[0] ?? local;
  if (!token) return fallback;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function dealerInitials(displayName: string, email: string | null | undefined): string {
  const fromName = displayName.trim().split(/\s+/).filter(Boolean);
  if (fromName.length >= 2) {
    return `${fromName[0][0] ?? ''}${fromName[1][0] ?? ''}`.toUpperCase();
  }
  const local = (email ?? displayName).split('@')[0] ?? 'D';
  return local.slice(0, 2).toUpperCase() || 'D';
}

export function sessionRooftopIds(session: DealerSession, requested?: string | null): string[] {
  const ids = session.rooftops.map((rooftop) => rooftop.id);
  if (!requested || requested === 'all') return ids;
  return ids.includes(requested) ? [requested] : [];
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export async function loadDealerMemberships(
  userId: string,
): Promise<DealerRooftop[]> {
  const admin = createAdminClient();
  const memberships = await admin
    .from('user_dealerships')
    .select('dealership_id, role')
    .eq('user_id', userId);
  if (memberships.error) {
    console.error(JSON.stringify({
      event: 'dealer_memberships_failed',
      message: memberships.error.message,
    }));
    throw new DealerAuthError('Drevvy could not load rooftop access.', 503, 'service_unavailable');
  }

  const rows = (memberships.data ?? []).filter((row): row is { dealership_id: string; role: string | null } => (
    typeof row.dealership_id === 'string' && row.dealership_id.length > 0
  ));
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((row) => row.dealership_id))];
  const dealerships = await admin
    .from('dealerships')
    .select('id, name')
    .in('id', ids);
  if (dealerships.error) {
    console.error(JSON.stringify({
      event: 'dealer_rooftops_failed',
      message: dealerships.error.message,
    }));
    throw new DealerAuthError('Drevvy could not load rooftop access.', 503, 'service_unavailable');
  }

  const names = new Map(
    (dealerships.data ?? [])
      .filter((row): row is { id: string; name: string } => typeof row.id === 'string')
      .map((row) => [row.id, typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Rooftop']),
  );

  return rows.flatMap((row) => {
    const name = names.get(row.dealership_id);
    if (!name) return [];
    return [{
      id: row.dealership_id,
      name,
      role: mapDealerRole(row.role),
    }];
  });
}

export function sessionFromUser(
  user: Pick<User, 'id' | 'email'>,
  rooftops: DealerRooftop[],
): DealerSession {
  const email = user.email ?? '';
  const displayName = dealerDisplayName(email);
  const role = highestDealerRole(rooftops.map((rooftop) => rooftop.role));
  return {
    userId: user.id,
    email,
    displayName,
    initials: dealerInitials(displayName, email),
    role,
    rooftops,
    canSwitchAllRooftops: role === 'owner_gm' && rooftops.length > 1,
  };
}

async function userFromRequest(request?: Request): Promise<User | null> {
  const token = request ? parseBearerToken(request.headers.get('authorization')) : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;

  if (token) {
    const supabase = createJwtClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    return user ?? null;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function loadDealerSession(request?: Request): Promise<DealerSession | null> {
  try {
    const user = await userFromRequest(request);
    if (!user) return null;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new DealerAuthError('Dealer desk is not configured.', 503, 'service_unavailable');
    }
    const rooftops = await loadDealerMemberships(user.id);
    if (rooftops.length === 0) return null;
    return sessionFromUser(user, rooftops);
  } catch (error) {
    if (error instanceof DealerAuthError) throw error;
    console.error(JSON.stringify({
      event: 'dealer_session_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return null;
  }
}

export async function requireDealerPageSession(): Promise<DealerSession | null> {
  const session = await loadDealerSession();
  if (session) return session;
  if (dealerPreviewEnabled()) return null;
  redirect('/dealer/login');
}

export async function requireDealerApi(request: Request): Promise<DealerSession> {
  const session = await loadDealerSession(request);
  if (session) return session;
  const user = await userFromRequest(request);
  if (user) {
    throw new DealerAuthError(
      'This work email is not on a Drevvy rooftop.',
      403,
      'not_a_dealer',
    );
  }
  throw new DealerAuthError('Sign in is required.', 401, 'unauthorized');
}

export function dealerAuthErrorResponse(error: DealerAuthError): NextResponse {
  return NextResponse.json(
    { error: error.code, message: error.message },
    { status: error.status },
  );
}

export function publicDealerSession(session: DealerSession) {
  return {
    source: 'live' as const,
    userId: session.userId,
    email: session.email,
    displayName: session.displayName,
    initials: session.initials,
    role: session.role,
    rooftops: session.rooftops.map((rooftop) => ({
      id: rooftop.id,
      name: rooftop.name,
      role: rooftop.role,
    })),
    canSwitchAllRooftops: session.canSwitchAllRooftops,
  };
}

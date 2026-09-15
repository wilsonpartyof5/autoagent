import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DealerMobileApiError,
  type DealerMobileAuth,
} from '@/lib/dealer-mobile/auth';

export type AuthorizedDealership = {
  id: string;
  name: string;
  marketcheckDealerId: string | null;
  marketcheckZip: string | null;
};

export type MobileDealership = {
  id: string;
  name: string;
  city: string;
  state: string;
};

async function isPlatformAdmin(supabase: SupabaseClient, userID: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('platform_role')
    .eq('id', userID)
    .maybeSingle();
  return data?.platform_role === 'platform_admin';
}

export async function listAuthorizedDealerships(
  auth: DealerMobileAuth,
): Promise<AuthorizedDealership[]> {
  if (await isPlatformAdmin(auth.supabase, auth.user.id)) {
    const { data, error } = await createAdminClient()
      .from('dealerships')
      .select('id, name, marketcheck_dealer_id, marketcheck_zip')
      .order('name');
    if (error) {
      throw new DealerMobileApiError('Dealerships could not be loaded.', 500, 'dealerships_unavailable');
    }
    return (data ?? []).map(mapDealershipRow);
  }

  const { data, error } = await auth.supabase
    .from('user_dealerships')
    .select('dealerships(id, name, marketcheck_dealer_id, marketcheck_zip)')
    .eq('user_id', auth.user.id);

  if (error) {
    throw new DealerMobileApiError('Dealerships could not be loaded.', 500, 'dealerships_unavailable');
  }

  return (data ?? [])
    .map((membership: any) =>
      Array.isArray(membership.dealerships)
        ? membership.dealerships[0]
        : membership.dealerships,
    )
    .filter(Boolean)
    .map(mapDealershipRow)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function requireDealershipAccess(
  auth: DealerMobileAuth,
  dealershipID: string,
): Promise<AuthorizedDealership> {
  const dealerships = await listAuthorizedDealerships(auth);
  const dealership = dealerships.find((item) => item.id === dealershipID);
  if (!dealership) {
    throw new DealerMobileApiError(
      'This dealership is not available to your account.',
      404,
      'dealership_not_found',
    );
  }
  return dealership;
}

export async function mobileDealerships(
  auth: DealerMobileAuth,
  dealerships: AuthorizedDealership[],
): Promise<MobileDealership[]> {
  if (dealerships.length === 0) return [];

  const ids = dealerships.map((dealership) => dealership.id);
  const dealerIDs = dealerships
    .map((dealership) => dealership.marketcheckDealerId)
    .filter((id): id is string => Boolean(id));

  let query = auth.supabase
    .from('uvs_vehicles')
    .select('dealership_id, dealer_id, dealer_city, dealer_state')
    .limit(500);

  const filters = [`dealership_id.in.(${ids.join(',')})`];
  if (dealerIDs.length > 0) {
    filters.push(`and(dealership_id.is.null,dealer_id.in.(${dealerIDs.join(',')}))`);
  }
  query = query.or(filters.join(','));

  const { data } = await query;
  const locations = new Map<string, { city: string; state: string }>();

  for (const vehicle of data ?? []) {
    const dealership = dealerships.find(
      (candidate) =>
        candidate.id === vehicle.dealership_id ||
        (!vehicle.dealership_id && candidate.marketcheckDealerId === vehicle.dealer_id),
    );
    if (dealership && !locations.has(dealership.id)) {
      locations.set(dealership.id, {
        city: vehicle.dealer_city ?? '',
        state: vehicle.dealer_state ?? '',
      });
    }
  }

  return dealerships.map((dealership) => ({
    id: dealership.id,
    name: dealership.name,
    city: locations.get(dealership.id)?.city ?? '',
    state: locations.get(dealership.id)?.state ?? '',
  }));
}

export async function activeDealershipID(auth: DealerMobileAuth): Promise<string | null> {
  const { data } = await auth.supabase
    .from('user_preferences')
    .select('active_dealership_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  return data?.active_dealership_id ?? null;
}

function mapDealershipRow(row: any): AuthorizedDealership {
  return {
    id: row.id,
    name: row.name,
    marketcheckDealerId: row.marketcheck_dealer_id ?? null,
    marketcheckZip: row.marketcheck_zip ?? null,
  };
}

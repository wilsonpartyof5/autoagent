import { createClient } from './server';
import { getActiveDealershipId } from './dealerships';

export type DealershipStatus = {
  hasInventory: boolean;
  inventoryCount: number;
  hasLeadDelivery: boolean;
};

/**
 * Get status information for a dealership
 */
export async function getDealershipStatus(dealershipId: string): Promise<DealershipStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasInventory: false,
      inventoryCount: 0,
      hasLeadDelivery: false,
    };
  }

  // Check UVS inventory count
  const { count: inventoryCount, error: invError } = await supabase
    .from('uvs_vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('availability_status', 'available');

  // Note: uvs_vehicles doesn't have dealership_id, so we count all available vehicles
  // If we need to scope by dealership, we'd need to add dealer_id filtering
  const count = inventoryCount ?? 0;
  const hasInventory = count > 0;

  // Check lead delivery settings (from profile for now, could be per-dealership later)
  const { data: profile } = await supabase
    .from('profiles')
    .select('lead_delivery_method, lead_delivery_endpoint, lead_delivery_email')
    .eq('id', user.id)
    .maybeSingle();

  const hasLeadDelivery = Boolean(
    profile?.lead_delivery_method &&
      (profile.lead_delivery_endpoint || profile.lead_delivery_email)
  );

  return {
    hasInventory,
    inventoryCount: count,
    hasLeadDelivery,
  };
}

/**
 * Get status for all user dealerships
 */
export async function getAllDealershipsStatus(
  dealershipIds: string[],
): Promise<Map<string, DealershipStatus>> {
  const statusMap = new Map<string, DealershipStatus>();

  await Promise.all(
    dealershipIds.map(async (id) => {
      const status = await getDealershipStatus(id);
      statusMap.set(id, status);
    }),
  );

  return statusMap;
}


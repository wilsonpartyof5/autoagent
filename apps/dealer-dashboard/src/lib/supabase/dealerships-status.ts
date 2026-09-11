import { createClient } from './server';
import { applyRooftopVehicleFilter } from '@/lib/db/rooftop-vehicles';

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

  const { data: dealership } = await supabase
    .from('dealerships')
    .select('id, marketcheck_dealer_id')
    .eq('id', dealershipId)
    .maybeSingle();

  if (!dealership) {
    return {
      hasInventory: false,
      inventoryCount: 0,
      hasLeadDelivery: false,
    };
  }

  const { count: inventoryCount } = await applyRooftopVehicleFilter(
    supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('availability_status', 'available'),
    dealershipId,
    dealership.marketcheck_dealer_id,
  );
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


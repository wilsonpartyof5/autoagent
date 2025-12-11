'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/analytics/tracking';
import { getActiveDealership } from '@/lib/supabase/dealerships';

export async function updateVehicleLiveStatus(
  vehicleId: string,
  isLive: boolean,
): Promise<{ success: boolean; error?: string; data?: { is_live: boolean; published_at: string | null; published_by: string | null } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get UVS vehicle to update
  const { data: vehicleRow, error: fetchError } = await supabase
    .from('uvs_vehicles')
    .select('id, uvs_data')
    .eq('id', vehicleId)
    .maybeSingle();

  if (fetchError || !vehicleRow || !vehicleRow.uvs_data) {
    return { success: false, error: 'Vehicle not found' };
  }

  // Update the vehicle in the database
  const { getUVSVehicleById, updateUVSVehicle } = await import('@/lib/db/uvs-vehicles');
  const existingVehicle = await getUVSVehicleById(vehicleId);
  if (!existingVehicle) {
    return { success: false, error: 'Vehicle not found' };
  }

  // Update with modified availability
  const updatedUVSVehicle = {
    ...existingVehicle,
    availability: {
      ...existingVehicle.availability,
      isLive: isLive,
      publishedAt: isLive
        ? new Date().toISOString()
        : existingVehicle.availability?.publishedAt ?? undefined,
    },
  };

  // Check for any errors from updateUVSVehicle
  try {
    await updateUVSVehicle(vehicleId, updatedUVSVehicle);
  } catch (error) {
    console.error('[inventory] Failed to update UVS vehicle live status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update vehicle status' 
    };
  }

  // Return success response matching expected format
  const data = {
    is_live: isLive,
    published_at: isLive ? new Date().toISOString() : null,
    published_by: isLive ? user.id : null,
  };

  // Track inventory status change event
  const activeDealership = await getActiveDealership();
  const vin = existingVehicle.baseIdentity?.vin;
  
  trackEvent('dashboard.inventory.status_change', {
    vehicleId,
    vin: vin || undefined,
    oldStatus: existingVehicle.availability?.isLive ? 'live' : 'not_live',
    newStatus: isLive ? 'live' : 'not_live',
  }, {
    dealerId: activeDealership?.marketcheckDealerId || undefined,
    vehicleId,
    vin: vin || undefined,
  }).catch(() => {
    // Tracking failures should not break the request
  });

  revalidatePath('/app/inventory');
  revalidatePath('/app/leads');

  return { success: true, data };
}

/**
 * Compare vehicles - minimal handler that emits vehicle.compare event
 */
export async function compareVehicles(
  vehicleIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!vehicleIds || vehicleIds.length < 2) {
    return { success: false, error: 'At least 2 vehicles required for comparison' };
  }

  // Get vehicles to extract VINs and dealer info
  const { data: vehicleRows, error: fetchError } = await supabase
    .from('uvs_vehicles')
    .select('id, uvs_data')
    .in('id', vehicleIds.slice(0, 10)); // Limit to 10 vehicles

  if (fetchError || !vehicleRows || vehicleRows.length === 0) {
    return { success: false, error: 'Vehicles not found' };
  }

  // Extract VINs and dealer info
  const { getUVSVehicleById } = await import('@/lib/db/uvs-vehicles');
  const vehicles = await Promise.all(
    vehicleRows.map(row => getUVSVehicleById(row.id))
  );
  const validVehicles = vehicles.filter((v): v is NonNullable<typeof v> => !!v);
  
  if (validVehicles.length === 0) {
    return { success: false, error: 'No valid vehicles found' };
  }

  const vins = validVehicles
    .map(v => v.baseIdentity?.vin)
    .filter((vin): vin is string => !!vin);
  
  const activeDealership = await getActiveDealership();
  const firstVehicle = validVehicles[0];
  const firstVin = firstVehicle.baseIdentity?.vin;
  
  // Extract dealerId from UVS structure: location.dealer.dealerId
  // Use activeDealership marketcheckDealerId if available, otherwise use vehicle's dealerId
  const resolvedDealerId = activeDealership?.marketcheckDealerId || firstVehicle.location?.dealer?.dealerId;

  // Track compare event
  await trackEvent('vehicle.compare', {
    vehicleIds: validVehicles.map(v => v.id).filter((id): id is string => !!id),
    vins: vins.length > 0 ? vins : undefined,
    compareCount: validVehicles.length,
  }, {
    dealerId: resolvedDealerId,
    vehicleId: firstVehicle.id,
    vin: firstVin || undefined,
  }).catch(() => {
    // Tracking failures should not break the request
  });

  return { success: true };
}

/**
 * Edit vehicle - minimal handler that emits dashboard.inventory.edit event
 * Note: This is a placeholder - actual edit functionality would update vehicle data
 */
export async function editVehicle(
  vehicleId: string,
  fieldsChanged: string[],
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get vehicle to extract VIN and dealer info
  const { getUVSVehicleById } = await import('@/lib/db/uvs-vehicles');
  const vehicle = await getUVSVehicleById(vehicleId);
  
  if (!vehicle) {
    return { success: false, error: 'Vehicle not found' };
  }

  const activeDealership = await getActiveDealership();
  const vin = vehicle.baseIdentity?.vin;
  
  // Extract dealerId from UVS structure: location.dealer.dealerId
  // Use activeDealership marketcheckDealerId if available, otherwise use vehicle's dealerId
  const resolvedDealerId = activeDealership?.marketcheckDealerId || vehicle.location?.dealer?.dealerId;

  // Track edit event (even if underlying operation is a no-op)
  await trackEvent('dashboard.inventory.edit', {
    vehicleId,
    vin: vin || undefined,
    fieldsChanged: fieldsChanged.length > 0 ? fieldsChanged : undefined,
  }, {
    dealerId: resolvedDealerId,
    vehicleId,
    vin: vin || undefined,
  }).catch(() => {
    // Tracking failures should not break the request
  });

  // Note: Actual edit functionality would update vehicle data here
  // For now, this is a minimal implementation that just tracks the event

  revalidatePath('/app/inventory');

  return { success: true };
}

/**
 * Delete vehicle - minimal handler that emits dashboard.inventory.delete event
 * Note: This is a placeholder - actual delete functionality would remove vehicle data
 */
export async function deleteVehicle(
  vehicleId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get vehicle to extract VIN and dealer info
  const { getUVSVehicleById } = await import('@/lib/db/uvs-vehicles');
  const vehicle = await getUVSVehicleById(vehicleId);
  
  if (!vehicle) {
    return { success: false, error: 'Vehicle not found' };
  }

  const activeDealership = await getActiveDealership();
  const vin = vehicle.baseIdentity?.vin;
  
  // Extract dealerId from UVS structure: location.dealer.dealerId
  // Use activeDealership marketcheckDealerId if available, otherwise use vehicle's dealerId
  const resolvedDealerId = activeDealership?.marketcheckDealerId || vehicle.location?.dealer?.dealerId;

  // Track delete event (even if underlying operation is a no-op)
  await trackEvent('dashboard.inventory.delete', {
    vehicleId,
    vin: vin || undefined,
  }, {
    dealerId: resolvedDealerId,
    vehicleId,
    vin: vin || undefined,
  }).catch(() => {
    // Tracking failures should not break the request
  });

  // Note: Actual delete functionality would remove vehicle data here
  // For now, this is a minimal implementation that just tracks the event

  revalidatePath('/app/inventory');

  return { success: true };
}

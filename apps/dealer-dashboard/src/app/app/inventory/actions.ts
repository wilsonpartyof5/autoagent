'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

  // Verify user owns this vehicle
  const { data: vehicle, error: fetchError } = await supabase
    .from('inventory_vehicles')
    .select('id, user_id')
    .eq('id', vehicleId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError || !vehicle) {
    return { success: false, error: 'Vehicle not found or access denied' };
  }

  // Prepare update payload
  const updatePayload: {
    is_live: boolean;
    published_at?: string;
    published_by?: string;
  } = {
    is_live: isLive,
  };

  // Set published_at and published_by only when turning ON
  if (isLive) {
    updatePayload.published_at = new Date().toISOString();
    updatePayload.published_by = user.id;
  }

  const { error: updateError, data } = await supabase
    .from('inventory_vehicles')
    .update(updatePayload)
    .eq('id', vehicleId)
    .eq('user_id', user.id)
    .select('is_live, published_at, published_by')
    .single();

  if (updateError) {
    console.error('[inventory] Failed to update live status:', updateError);
    // Check if the error is due to missing column
    if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
      return { 
        success: false, 
        error: 'Database migration required. Please run the migration to add is_live column.' 
      };
    }
    return { success: false, error: updateError.message || 'Failed to update vehicle status' };
  }

  if (!data) {
    return { success: false, error: 'No data returned from update' };
  }

  revalidatePath('/app/inventory');
  revalidatePath('/app/leads');

  return { success: true, data };
}


import { createClient } from './server';
import { createAdminClient } from './admin';

export type Dealership = {
  id: string;
  name: string;
  marketcheckDealerId: string | null;
  marketcheckZip: string | null;
  marketcheckWebsiteUrl: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserDealership = {
  userId: string;
  dealershipId: string;
  role: string;
  dealership: Dealership;
};

/**
 * Fetch all dealerships for the current user
 */
export async function fetchUserDealerships(): Promise<Dealership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_dealerships')
    .select('dealership_id, dealerships(*)')
    .eq('user_id', user.id);

  if (error) {
    console.error('[dealerships] Failed to fetch user dealerships:', error);
    return [];
  }

  if (!data) {
    return [];
  }

  return data
    .map((row: any) => row.dealerships)
    .filter((d: Dealership | null): d is Dealership => d !== null)
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      marketcheckDealerId: d.marketcheck_dealer_id ?? null,
      marketcheckZip: d.marketcheck_zip ?? null,
      marketcheckWebsiteUrl: d.marketcheck_website_url ?? null,
      logoUrl: d.logo_url ?? null,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
}

/**
 * Get the active dealership ID for the current user
 */
export async function getActiveDealershipId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('active_dealership_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[dealerships] Failed to fetch active dealership:', error);
    return null;
  }

  return data?.active_dealership_id ?? null;
}

/**
 * Get the active dealership for the current user
 */
export async function getActiveDealership(): Promise<Dealership | null> {
  const activeDealershipId = await getActiveDealershipId();

  if (!activeDealershipId) {
    // If no active dealership, try to get the first one
    const dealerships = await fetchUserDealerships();
    if (dealerships.length > 0) {
      // Set the first one as active
      await setActiveDealership(dealerships[0].id);
      return dealerships[0];
    }
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Verify user has access to this dealership
  const { data, error } = await supabase
    .from('dealerships')
    .select('*')
    .eq('id', activeDealershipId)
    .maybeSingle();

  if (error || !data) {
    console.error('[dealerships] Failed to fetch active dealership:', error);
    return null;
  }

  // Verify user has access
  const { data: membership } = await supabase
    .from('user_dealerships')
    .select('dealership_id')
    .eq('user_id', user.id)
    .eq('dealership_id', activeDealershipId)
    .maybeSingle();

  if (!membership) {
    // User doesn't have access, get first available
    const dealerships = await fetchUserDealerships();
    if (dealerships.length > 0) {
      await setActiveDealership(dealerships[0].id);
      return dealerships[0];
    }
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    marketcheckDealerId: data.marketcheck_dealer_id ?? null,
    marketcheckZip: data.marketcheck_zip ?? null,
    marketcheckWebsiteUrl: data.marketcheck_website_url ?? null,
    logoUrl: data.logo_url ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Set the active dealership for the current user
 */
export async function setActiveDealership(dealershipId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Verify user has access to this dealership
  const { data: membership, error: membershipError } = await supabase
    .from('user_dealerships')
    .select('dealership_id')
    .eq('user_id', user.id)
    .eq('dealership_id', dealershipId)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error('You do not have access to this dealership');
  }

  // Update or insert user preference
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: user.id,
        active_dealership_id: dealershipId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      },
    );

  if (error) {
    console.error('[dealerships] Failed to set active dealership:', error);
    throw new Error('Failed to set active dealership');
  }
}

/**
 * Create a new dealership and link it to the current user
 */
export async function createDealership(payload: {
  name: string;
  marketcheckDealerId?: string | null;
  marketcheckZip?: string | null;
  marketcheckWebsiteUrl?: string | null;
  logoUrl?: string | null;
}): Promise<Dealership> {
  const supabase = await createClient();
  const admin = createAdminClient(); // bypass RLS for creation
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Create dealership
  const { data: dealership, error: dealershipError } = await admin
    .from('dealerships')
    .insert({
      name: payload.name,
      marketcheck_dealer_id: payload.marketcheckDealerId ?? null,
      marketcheck_zip: payload.marketcheckZip ?? null,
      marketcheck_website_url: payload.marketcheckWebsiteUrl ?? null,
      logo_url: payload.logoUrl ?? null,
    })
    .select()
    .single();

  if (dealershipError || !dealership) {
    console.error('[dealerships] Failed to create dealership:', dealershipError);
    throw new Error('Failed to create dealership');
  }

  // Link user to dealership
  const { error: membershipError } = await admin
    .from('user_dealerships')
    .insert({
      user_id: user.id,
      dealership_id: dealership.id,
      role: 'owner',
    });

  if (membershipError) {
    console.error('[dealerships] Failed to link user to dealership:', membershipError);
    // Clean up dealership if membership creation fails
    await supabase.from('dealerships').delete().eq('id', dealership.id);
    throw new Error('Failed to link user to dealership');
  }

  // Set as active dealership if it's the first one
  const existingDealerships = await fetchUserDealerships();
  if (existingDealerships.length === 1) {
    await setActiveDealership(dealership.id);
  }

  return {
    id: dealership.id,
    name: dealership.name,
    marketcheckDealerId: dealership.marketcheck_dealer_id ?? null,
    marketcheckZip: dealership.marketcheck_zip ?? null,
    marketcheckWebsiteUrl: dealership.marketcheck_website_url ?? null,
    logoUrl: dealership.logo_url ?? null,
    createdAt: dealership.created_at,
    updatedAt: dealership.updated_at,
  };
}

/**
 * Update an existing dealership
 */
export async function updateDealership(
  dealershipId: string,
  payload: {
    name?: string;
    marketcheckDealerId?: string | null;
    marketcheckZip?: string | null;
    marketcheckWebsiteUrl?: string | null;
    logoUrl?: string | null;
  },
): Promise<Dealership> {
  const supabase = createAdminClient(); // use admin client to avoid RLS blocks

  // Update dealership
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) {
    updateData.name = payload.name;
  }
  if (payload.marketcheckDealerId !== undefined) {
    updateData.marketcheck_dealer_id = payload.marketcheckDealerId;
  }
  if (payload.marketcheckZip !== undefined) {
    updateData.marketcheck_zip = payload.marketcheckZip;
  }
  if (payload.marketcheckWebsiteUrl !== undefined) {
    updateData.marketcheck_website_url = payload.marketcheckWebsiteUrl;
  }
  if (payload.logoUrl !== undefined) {
    updateData.logo_url = payload.logoUrl;
  }

  const { data: dealership, error: dealershipError } = await supabase
    .from('dealerships')
    .update(updateData)
    .eq('id', dealershipId)
    .select()
    .single();

  if (dealershipError || !dealership) {
    console.error('[dealerships] Failed to update dealership:', dealershipError);
    throw new Error('Failed to update dealership');
  }

  return {
    id: dealership.id,
    name: dealership.name,
    marketcheckDealerId: dealership.marketcheck_dealer_id ?? null,
    marketcheckZip: dealership.marketcheck_zip ?? null,
    marketcheckWebsiteUrl: dealership.marketcheck_website_url ?? null,
    logoUrl: dealership.logo_url ?? null,
    createdAt: dealership.created_at,
    updatedAt: dealership.updated_at,
  };
}

/**
 * Get active dealership ID (server-side, for use in server actions)
 */
export async function getActiveDealershipIdForUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_preferences')
    .select('active_dealership_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[dealerships] Failed to fetch active dealership for user:', error);
    return null;
  }

  return data?.active_dealership_id ?? null;
}


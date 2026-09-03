import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Detects prelinked dealership state for brand-new accounts.
 * Self-created rooftops during onboarding are allowed; memberships to
 * dealerships that existed before the user are not.
 */
export async function checkOnboardingIntegrity(
  supabase: SupabaseClient,
  userId: string
): Promise<{ isValid: boolean; errorMessage?: string; details?: Record<string, unknown> }> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('marketcheck_dealer_id, onboarding_completed, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[integrity-check] Error fetching profile:', profileError);
      return { isValid: true };
    }

    if (!profile) {
      return { isValid: true };
    }

    if (profile.onboarding_completed) {
      return { isValid: true };
    }

    const accountCreatedAt = new Date(profile.created_at).getTime();
    const accountAgeMinutes = (Date.now() - accountCreatedAt) / (1000 * 60);
    if (accountAgeMinutes >= 10) {
      return { isValid: true };
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('user_dealerships')
      .select('dealership_id, role, created_at')
      .eq('user_id', userId);

    if (membershipError) {
      console.error('[integrity-check] Error fetching memberships:', membershipError);
      return { isValid: true };
    }

    const membershipIds = (memberships ?? []).map((row) => row.dealership_id);
    let prelinkedDealership = false;

    if (membershipIds.length > 0) {
      const { data: rooftops, error: rooftopError } = await supabase
        .from('dealerships')
        .select('id, created_at, marketcheck_dealer_id')
        .in('id', membershipIds);

      if (rooftopError) {
        console.error('[integrity-check] Error fetching dealerships:', rooftopError);
        return { isValid: true };
      }

      prelinkedDealership = (rooftops ?? []).some((rooftop) => {
        const rooftopCreatedAt = new Date(rooftop.created_at).getTime();
        return rooftopCreatedAt < accountCreatedAt - 5_000;
      });
    }

    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('active_dealership_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferencesError) {
      console.error('[integrity-check] Error fetching preferences:', preferencesError);
      return { isValid: true };
    }

    let prelinkedPreference = false;
    if (preferences?.active_dealership_id && !membershipIds.includes(preferences.active_dealership_id)) {
      const { data: preferred } = await supabase
        .from('dealerships')
        .select('id, created_at')
        .eq('id', preferences.active_dealership_id)
        .maybeSingle();
      if (preferred && new Date(preferred.created_at).getTime() < accountCreatedAt - 5_000) {
        prelinkedPreference = true;
      }
    }

    if (prelinkedDealership || prelinkedPreference) {
      const details = {
        userId,
        accountAgeMinutes: Math.round(accountAgeMinutes * 10) / 10,
        prelinkedDealership,
        prelinkedPreference,
        membershipCount: memberships?.length ?? 0,
        onboardingCompleted: profile.onboarding_completed,
      };

      console.error('[integrity-check] BLOCKED - prelinked rooftop on a new account:', details);

      return {
        isValid: false,
        errorMessage:
          'Your account setup appears incomplete. Please contact support for assistance.',
        details,
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('[integrity-check] Unexpected error:', error);
    return { isValid: true };
  }
}

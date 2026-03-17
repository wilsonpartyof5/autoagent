import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Onboarding Integrity Check
 * 
 * Detects suspicious prelinked dealership state for newly created users.
 * This prevents cross-tenant data leakage by blocking onboarding when:
 * - User has dealership memberships they shouldn't have
 * - User has MarketCheck dealer ID set in profile (should be set during onboarding)
 * - User has active dealership preference before completing onboarding
 * 
 * @param supabase - Supabase client (can be regular or admin)
 * @param userId - User ID to check
 * @returns Object with isValid boolean and optional errorMessage
 */
export async function checkOnboardingIntegrity(
  supabase: SupabaseClient,
  userId: string
): Promise<{ isValid: boolean; errorMessage?: string; details?: Record<string, unknown> }> {
  try {
    // Check 1: Get profile to see if MarketCheck ID is already set
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('marketcheck_dealer_id, onboarding_completed, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[integrity-check] Error fetching profile:', profileError);
      // Don't block on query errors - fail open for better UX
      return { isValid: true };
    }

    if (!profile) {
      // No profile found - unusual but let trigger create it
      return { isValid: true };
    }

    // Calculate account age
    const accountAgeMs = Date.now() - new Date(profile.created_at).getTime();
    const accountAgeMinutes = accountAgeMs / (1000 * 60);
    
    // Only check new accounts (< 10 minutes old) to avoid false positives
    // Older accounts may have legitimately completed onboarding
    const isNewAccount = accountAgeMinutes < 10;

    // If account is not new, skip integrity checks
    if (!isNewAccount) {
      return { isValid: true };
    }

    // Check 2: Get user dealership memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('user_dealerships')
      .select('dealership_id, role, created_at')
      .eq('user_id', userId);

    if (membershipError) {
      console.error('[integrity-check] Error fetching memberships:', membershipError);
      return { isValid: true }; // Fail open
    }

    // Check 3: Get user preferences (active dealership)
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('active_dealership_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferencesError) {
      console.error('[integrity-check] Error fetching preferences:', preferencesError);
      return { isValid: true }; // Fail open
    }

    // Suspicious state detection for NEW accounts only
    const hasMemberships = memberships && memberships.length > 0;
    const hasMarketCheckId = Boolean(profile.marketcheck_dealer_id);
    const hasActivePreference = Boolean(preferences?.active_dealership_id);

    // A brand new account should NOT have any of these set
    if (hasMemberships || hasMarketCheckId || hasActivePreference) {
      const errorMessage =
        'Your account setup appears incomplete. Please contact support for assistance.';
      
      const details = {
        userId,
        accountAgeMinutes: Math.round(accountAgeMinutes * 10) / 10,
        hasMemberships,
        hasMarketCheckId,
        hasActivePreference,
        membershipCount: memberships?.length ?? 0,
        onboardingCompleted: profile.onboarding_completed,
      };

      // Log for ops monitoring
      console.error('[integrity-check] BLOCKED - Suspicious prelinked state detected:', details);

      return {
        isValid: false,
        errorMessage,
        details,
      };
    }

    // All clear
    return { isValid: true };
  } catch (error) {
    console.error('[integrity-check] Unexpected error:', error);
    // Fail open on unexpected errors to avoid blocking legitimate users
    return { isValid: true };
  }
}

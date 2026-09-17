import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Onboarding Integrity Check
 * 
 * Detects suspicious prelinked dealership state for newly created users.
 * This prevents cross-tenant data leakage by blocking onboarding when:
 * - A membership predates the user's profile
 * - A MarketCheck dealer ID exists without a dealership membership
 * - The active dealership preference is not one of the user's memberships
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

    // Memberships created after the profile can be legitimate onboarding or
    // invite-backed state. There is no creator column to prove provenance, so
    // creation time is the strongest signal available for older memberships.
    const profileCreatedAt = new Date(profile.created_at).getTime();
    const suspiciousMemberships = (memberships ?? []).filter((membership) => {
      const membershipCreatedAt = new Date(membership.created_at).getTime();
      return (
        !Number.isFinite(membershipCreatedAt) ||
        membershipCreatedAt < profileCreatedAt
      );
    });
    const dealershipIds = new Set(
      (memberships ?? []).map((membership) => membership.dealership_id),
    );
    const hasMarketCheckId = Boolean(profile.marketcheck_dealer_id);
    const hasActivePreference = Boolean(preferences?.active_dealership_id);
    const hasOrphanedMarketCheckId = hasMarketCheckId && dealershipIds.size === 0;
    const hasUnlinkedActivePreference =
      hasActivePreference &&
      !dealershipIds.has(preferences?.active_dealership_id);

    if (
      suspiciousMemberships.length > 0 ||
      hasOrphanedMarketCheckId ||
      hasUnlinkedActivePreference
    ) {
      const errorMessage =
        'Your account setup appears incomplete. Please contact support for assistance.';
      
      const details = {
        userId,
        accountAgeMinutes: Math.round(accountAgeMinutes * 10) / 10,
        hasMemberships: dealershipIds.size > 0,
        hasMarketCheckId,
        hasActivePreference,
        membershipCount: memberships?.length ?? 0,
        suspiciousMembershipCount: suspiciousMemberships.length,
        hasOrphanedMarketCheckId,
        hasUnlinkedActivePreference,
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

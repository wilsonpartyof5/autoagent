import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Block a new account that was attached as owner of a rooftop they did not create.
 * Self-created rooftops (create_own_dealership / created_by = user) are allowed.
 * Invited staff (non-owner) are allowed. Age heuristics are not used.
 */
export async function checkOnboardingIntegrity(
  supabase: SupabaseClient,
  userId: string
): Promise<{ isValid: boolean; errorMessage?: string; details?: Record<string, unknown> }> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed, platform_role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[integrity-check] Error fetching profile:', profileError);
      return { isValid: true };
    }

    if (!profile || profile.onboarding_completed || profile.platform_role === 'platform_admin') {
      return { isValid: true };
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('user_dealerships')
      .select('dealership_id, role')
      .eq('user_id', userId);

    if (membershipError) {
      console.error('[integrity-check] Error fetching memberships:', membershipError);
      return { isValid: true };
    }

    const ownerIds = (memberships ?? [])
      .filter((row) => row.role === 'owner')
      .map((row) => row.dealership_id);

    if (ownerIds.length === 0) {
      return { isValid: true };
    }

    const { data: rooftops, error: rooftopError } = await supabase
      .from('dealerships')
      .select('id, created_by')
      .in('id', ownerIds);

    if (rooftopError) {
      // created_by may not exist until the migration is applied.
      if (rooftopError.message?.includes('created_by') || rooftopError.code === '42703') {
        return { isValid: true };
      }
      console.error('[integrity-check] Error fetching dealerships:', rooftopError);
      return { isValid: true };
    }

    const prelinkedOwner = (rooftops ?? []).some(
      (rooftop) => rooftop.created_by && rooftop.created_by !== userId,
    );

    if (prelinkedOwner) {
      const details = {
        userId,
        membershipCount: memberships?.length ?? 0,
        onboardingCompleted: profile.onboarding_completed,
      };
      console.error('[integrity-check] BLOCKED - owner of a rooftop created by someone else:', details);
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

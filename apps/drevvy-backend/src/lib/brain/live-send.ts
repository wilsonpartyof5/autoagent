/**
 * Assign a conversation identity before the first live email, text, widget
 * message, or call. A later send reads the same row. Test mode does not
 * assign. A courtesy call in test mode still reads the deal, then takes the
 * reply text number from DREVVY_TEST_TEXT_NUMBER or DREVVY_TEXT_NUMBER and
 * the reply email from DREVVY_EMAIL. That text number is never the caller ID.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { readVehicleCallFields } from './courtesy-call';
import { readShopperFirstName, type ConversationIdentity } from './identity';
import { ensureConversationIdentity, readLivePurchaseFlag } from './identity-store';

export type LiveChannel = 'email' | 'sms' | 'voice' | 'widget';

export type LiveAssignment = {
  supabase: SupabaseClient;
  shopperId?: string | null;
  dealerState?: string | null;
  random?: () => number;
};

export type ResolvedLiveIdentity =
  | { held: false; identity: ConversationIdentity | null }
  | { held: true; error: string; purchaseFlag: boolean };

export async function resolveLiveIdentity(input: {
  channel: LiveChannel;
  testMode: boolean;
  identity?: ConversationIdentity | null;
  assignment?: LiveAssignment | null;
  dealId?: string | null;
  dealerId?: string | null;
}): Promise<ResolvedLiveIdentity> {
  if (input.testMode) return { held: false, identity: input.identity ?? null };
  if (!input.assignment) return { held: false, identity: input.identity ?? null };
  if (!input.dealId || !input.dealerId) {
    return { held: true, error: `A ${input.channel} send needs a deal and a dealer.`, purchaseFlag: false };
  }

  const deal = await loadDeal(input.assignment.supabase, input.dealId);
  const shopperId = input.assignment.shopperId?.trim() || deal.shopperId;
  if (!shopperId) {
    return { held: true, error: 'The deal has no shopper.', purchaseFlag: false };
  }
  const dealerState = input.assignment.dealerState?.trim() || deal.state;

  const assigned = await ensureConversationIdentity(input.assignment.supabase, {
    dealId: input.dealId,
    dealerId: input.dealerId,
    shopperId,
    dealerState,
    isTest: false,
    random: input.assignment.random,
  });
  if ('error' in assigned) {
    return {
      held: true,
      error: assigned.error,
      purchaseFlag: await readLivePurchaseFlag(input.assignment.supabase),
    };
  }
  return { held: false, identity: assigned };
}

export async function loadCourtesyContext(
  supabase: SupabaseClient,
  dealId: string,
): Promise<{ shopperFirstName: string | null; stock: string | null; vin: string | null }> {
  const { data } = await supabase
    .from('shopper_deals')
    .select('consumer_user_id, vehicle_snapshot')
    .eq('id', dealId)
    .maybeSingle();
  const vehicle = readVehicleCallFields(data?.vehicle_snapshot);
  const shopperId = typeof data?.consumer_user_id === 'string' && data.consumer_user_id ? data.consumer_user_id : null;
  if (!shopperId) return { shopperFirstName: null, ...vehicle };
  const profile = await supabase
    .from('consumer_profiles')
    .select('first_name')
    .eq('user_id', shopperId)
    .maybeSingle();
  const first = typeof profile.data?.first_name === 'string' ? profile.data.first_name : null;
  return { shopperFirstName: readShopperFirstName(first, null), ...vehicle };
}

async function loadDeal(
  supabase: SupabaseClient,
  dealId: string,
): Promise<{ shopperId: string | null; state: string | null }> {
  const { data } = await supabase
    .from('shopper_deals')
    .select('consumer_user_id, vehicle_snapshot')
    .eq('id', dealId)
    .maybeSingle();
  const shopperId = typeof data?.consumer_user_id === 'string' && data.consumer_user_id ? data.consumer_user_id : null;
  return { shopperId, state: stateFromSnapshot(data?.vehicle_snapshot) };
}

function stateFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const state = (snapshot as { state?: unknown }).state;
  if (typeof state !== 'string') return null;
  const code = state.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

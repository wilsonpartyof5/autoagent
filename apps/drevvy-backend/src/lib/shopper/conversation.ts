import type { SupabaseClient } from '@supabase/supabase-js';

import {
  resolveRooftopMatch,
  type RooftopDirectory,
} from '@/lib/dealer/rooftop-store';
import {
  inNetworkOpener,
  shopperFirstNameOnly,
  type ListingDealerIdentity,
  type RooftopMatch,
} from '@/lib/dealer/rooftop-match';
import { addShopperCar, type CreditSummary, type DealDeps } from './deal-actions';
import { ShopperDealError, isShopperListingId, readCreateDealInput } from './deals';
import type { PresentedDeal } from './lifecycle';

export type ConversationStartResult = {
  deal: PresentedDeal;
  credits: CreditSummary;
  match: Extract<RooftopMatch, { matched: true }>;
  shopperFirstName: string | null;
};

export async function requireInNetworkMatch(
  identity: ListingDealerIdentity,
  rooftops: RooftopDirectory,
): Promise<Extract<RooftopMatch, { matched: true }>> {
  const match = await resolveRooftopMatch(identity, rooftops);
  if (!match.matched) {
    throw new ShopperDealError(
      'This dealership is not on Drevvy. Request their out-the-door number instead of starting a chat.',
      409,
      'off_network',
    );
  }
  return match;
}

export async function startDealerConversation(
  userId: string,
  body: unknown,
  deps: DealDeps & { rooftops: RooftopDirectory },
): Promise<ConversationStartResult> {
  const input = readCreateDealInput(body);
  const listingId = isShopperListingId(input.listingId) ? input.listingId : null;
  const listingUrl = body && typeof body === 'object' && !Array.isArray(body)
    ? optionalUrl((body as { listingUrl?: unknown }).listingUrl)
    : null;
  const zip = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { zip?: unknown }).zip
    : undefined;

  const match = await requireInNetworkMatch({ listingId, listingUrl }, deps.rooftops);
  const shopperFirstName = deps.supabase ? await loadShopperFirstName(deps.supabase, userId) : null;
  const namedMatch = { ...match, opener: inNetworkOpener(shopperFirstName) };
  const result = await addShopperCar(userId, { ...input, zip }, deps);
  if (deps.supabase && listingId) {
    await recordInNetworkConversation(deps.supabase, {
      dealId: result.deal.id,
      userId,
      listingId,
      match: namedMatch,
      shopperFirstName,
    });
  }
  return { ...result, match: namedMatch, shopperFirstName };
}

async function loadShopperFirstName(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('consumer_profiles')
    .select('first_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({ event: 'shopper_first_name_failed', message: error.message }));
    return null;
  }
  return shopperFirstNameOnly(typeof data?.first_name === 'string' ? data.first_name : null);
}

async function recordInNetworkConversation(
  supabase: SupabaseClient,
  input: {
    dealId: string;
    userId: string;
    listingId: string;
    match: Extract<RooftopMatch, { matched: true }>;
    shopperFirstName: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('shopper_dealer_conversations').upsert({
    deal_id: input.dealId,
    consumer_user_id: input.userId,
    listing_id: input.listingId,
    rooftop_id: input.match.rooftop.id,
    match_method: input.match.method,
    channel: input.match.channel,
    shopper_known: true,
    shopper_first_name: input.shopperFirstName,
    opener: input.match.opener,
  }, { onConflict: 'deal_id' });
  if (error) {
    console.error(JSON.stringify({
      event: 'in_network_conversation_record_failed',
      dealId: input.dealId,
      message: error.message,
    }));
  }
}

function optionalUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ShopperDealError('listingUrl must be a URL.', 400, 'invalid_request');
  }
  return value.trim();
}

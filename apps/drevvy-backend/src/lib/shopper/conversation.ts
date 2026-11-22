import type { SupabaseClient } from '@supabase/supabase-js';

import {
  resolveRooftopMatch,
  type RooftopDirectory,
  type RooftopResolveOptions,
} from '@/lib/dealer/rooftop-store';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';
import {
  IN_NETWORK_CHANNEL,
  inNetworkOpener,
  shopperFirstNameOnly,
  type ListingDealerIdentity,
  type MatchMethod,
  type RooftopMatch,
} from '@/lib/dealer/rooftop-match';
import { recordInNetworkVdpMatch } from '@/lib/dealer/vdp-match';
import { addShopperCar, type CreditSummary, type DealDeps } from './deal-actions';
import { checkCanAddCar } from './credits';
import { ShopperDealError, isShopperListingId, readCreateDealInput } from './deals';
import { enforceDealPostLimit } from './off-network-lookup-limit';
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
  options?: RooftopResolveOptions,
): Promise<Extract<RooftopMatch, { matched: true }>> {
  const match = await resolveRooftopMatch(identity, rooftops, options);
  if (!match.matched) {
    throw new ShopperDealError(
      'This dealership is not on Drevvy. Request their out-the-door number instead of starting a chat.',
      409,
      'off_network',
    );
  }
  return match;
}

type ConversationDeps = DealDeps & {
  rooftops: RooftopDirectory;
  rateLimitStore?: RateLimitStore;
  rateLimitEnv?: NodeJS.ProcessEnv;
};

export async function startDealerConversation(
  userId: string,
  body: unknown,
  deps: ConversationDeps,
): Promise<ConversationStartResult> {
  const input = readCreateDealInput(body);
  const listingId = isShopperListingId(input.listingId) ? input.listingId : null;
  const listingUrl = body && typeof body === 'object' && !Array.isArray(body)
    ? optionalUrl((body as { listingUrl?: unknown }).listingUrl)
    : null;
  const zip = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { zip?: unknown }).zip
    : undefined;

  const nowMs = deps.now.getTime();
  if (listingId) {
    const existing = await deps.deals.findOpen(userId, listingId);
    if (existing) {
      const result = await addShopperCar(userId, { ...input, zip }, deps);
      const shopperFirstName = deps.supabase ? await loadShopperFirstName(deps.supabase, userId) : null;
      const stored = deps.supabase ? await loadStoredInNetworkMatch(deps.supabase, existing.id) : null;
      if (!stored) {
        console.error(JSON.stringify({ event: 'open_deal_match_missing', dealId: existing.id }));
      }
      const namedMatch = {
        ...(stored ?? openDealMatch(existing.id)),
        opener: inNetworkOpener(shopperFirstName),
      };
      return { ...result, match: namedMatch, shopperFirstName };
    }
  }

  await enforceDealPostLimit({
    userId,
    nowMs,
    store: deps.rateLimitStore,
    env: deps.rateLimitEnv,
  });
  if (deps.supabase) {
    const creditCheck = await checkCanAddCar(deps.supabase, userId);
    if (!creditCheck.canAdd) {
      throw new ShopperDealError(
        'You need a key to open a dealer conversation. Buy a key pack to continue.',
        402,
        'no_credits',
      );
    }
  }

  const match = await requireInNetworkMatch({ listingId, listingUrl }, deps.rooftops, { nowMs });
  const shopperFirstName = deps.supabase ? await loadShopperFirstName(deps.supabase, userId) : null;
  const namedMatch = { ...match, opener: inNetworkOpener(shopperFirstName) };
  const vdpMatchId = deps.supabase && listingId
    ? await recordInNetworkVdpMatch(deps.supabase, { listingId, listingUrl, match: namedMatch })
    : null;
  const result = await addShopperCar(userId, { ...input, zip, vdpMatchId }, deps);
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

const MATCH_METHODS: readonly MatchMethod[] = ['marketcheck_dealer_id', 'listing_url', 'dealer_domain'];

async function loadStoredInNetworkMatch(
  supabase: SupabaseClient,
  dealId: string,
): Promise<Extract<RooftopMatch, { matched: true }> | null> {
  const { data, error } = await supabase
    .from('shopper_dealer_conversations')
    .select('rooftop_id, match_method, opener')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error(JSON.stringify({ event: 'open_deal_match_unreadable', dealId, message: error.message }));
    }
    return null;
  }
  const rooftopId = typeof data.rooftop_id === 'string' ? data.rooftop_id : '';
  const method = MATCH_METHODS.find((item) => item === data.match_method);
  if (!rooftopId || !method) return null;
  return {
    matched: true,
    network: 'in_network',
    rooftop: { id: rooftopId, name: '', marketcheckDealerId: null, websiteUrl: null },
    method,
    channel: IN_NETWORK_CHANNEL,
    shopperKnown: true,
    opener: typeof data.opener === 'string' && data.opener.trim() ? data.opener : inNetworkOpener(null),
  };
}

function openDealMatch(dealId: string): Extract<RooftopMatch, { matched: true }> {
  return {
    matched: true,
    network: 'in_network',
    rooftop: { id: dealId, name: '', marketcheckDealerId: null, websiteUrl: null },
    method: 'marketcheck_dealer_id',
    channel: IN_NETWORK_CHANNEL,
    shopperKnown: true,
    opener: inNetworkOpener(null),
  };
}

function optionalUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ShopperDealError('listingUrl must be a URL.', 400, 'invalid_request');
  }
  return value.trim();
}

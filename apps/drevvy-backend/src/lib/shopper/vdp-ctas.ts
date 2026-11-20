import { ShopperDealError, isShopperListingId } from './deals';
import {
  type ListingIdentityLookup,
  type RooftopDirectory,
} from '@/lib/dealer/rooftop-store';
import {
  dealerIdentityVerified,
  matchOnboardedRooftop,
  type ListingDealerIdentity,
  type OnboardedRooftop,
  type RooftopMatch,
} from '@/lib/dealer/rooftop-match';

export type VdpCtaKind = 'market_intel' | 'dealer_conversation' | 'off_network_otd_request';

export type VdpCta = {
  kind: VdpCtaKind;
  keyCost: 0 | 1;
  endpoint: string;
};

export type VdpCtaSet = {
  network: RooftopMatch['network'];
  match: RooftopMatch;
  ctas: VdpCta[];
};

/**
 * Shopper-facing network lookup. Exactly one of these states.
 * `off_network` is a verified miss. An identity failure is never off-network.
 */
export const SHOPPER_NETWORK_STATES = [
  'in_network',
  'off_network',
  'identity_unavailable',
  'unknown',
] as const;

export type ShopperNetworkState = (typeof SHOPPER_NETWORK_STATES)[number];

export type ShopperNetworkLookup = {
  state: ShopperNetworkState;
  ctas: VdpCta[];
};

export type NetworkLookupDeps = RooftopDirectory & {
  lookupListingIdentity: (listingId: string) => Promise<ListingIdentityLookup>;
};

const MARKET_INTEL: VdpCta = {
  kind: 'market_intel',
  keyCost: 1,
  endpoint: 'POST /api/consumer/keys/market-save',
};

const CONVERSATION: VdpCta = {
  kind: 'dealer_conversation',
  keyCost: 1,
  endpoint: 'POST /api/consumer/keys/conversation',
};

const OTD_REQUEST: VdpCta = {
  kind: 'off_network_otd_request',
  keyCost: 0,
  endpoint: 'POST /api/consumer/otd-requests',
};

export function ctasForMatch(match: RooftopMatch): VdpCtaSet {
  if (match.matched) {
    return { network: 'in_network', match, ctas: [MARKET_INTEL, CONVERSATION] };
  }
  return { network: 'off_network', match, ctas: [MARKET_INTEL, OTD_REQUEST] };
}

export function readListingIdentityBody(body: unknown): ListingDealerIdentity {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ShopperDealError('Send a listing id or listing URL.', 400, 'invalid_request');
  }
  const record = body as Record<string, unknown>;
  const listingId = record.listingId;
  const listingUrl = optionalText(record.listingUrl);
  if (listingId !== undefined && listingId !== null && !isShopperListingId(listingId)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }
  if (!listingId && !listingUrl) {
    throw new ShopperDealError('Send a listing id or listing URL.', 400, 'invalid_request');
  }
  return {
    listingId: typeof listingId === 'string' ? listingId : null,
    listingUrl,
  };
}

/**
 * Classifies one listing for the shopper VDP.
 * Reads MarketCheck and the onboarded rooftop list. It does not write,
 * and it does not submit an out-the-door request.
 * The client listing URL is not identity. Only the MarketCheck result is.
 */
export async function resolveVdpCtas(
  body: unknown,
  deps: NetworkLookupDeps,
): Promise<ShopperNetworkLookup> {
  const request = readListingIdentityBody(body);
  if (!request.listingId) return closedNetwork('unknown');

  let looked: ListingIdentityLookup;
  try {
    looked = await deps.lookupListingIdentity(request.listingId);
  } catch {
    return closedNetwork('identity_unavailable');
  }
  if (looked.status === 'unavailable') return closedNetwork('identity_unavailable');
  if (!dealerIdentityVerified(looked.identity)) return closedNetwork('unknown');

  let rooftops: OnboardedRooftop[];
  try {
    rooftops = await deps.listOnboardedRooftops();
  } catch {
    return closedNetwork('unknown');
  }

  const match = matchOnboardedRooftop(looked.identity, rooftops);
  if (match.matched) {
    return { state: 'in_network', ctas: [MARKET_INTEL, CONVERSATION] };
  }
  return { state: 'off_network', ctas: [MARKET_INTEL, OTD_REQUEST] };
}

/** Public body. No JWT, dealer URL, dealer id, or rooftop id. */
export function publicShopperNetwork(lookup: ShopperNetworkLookup): ShopperNetworkLookup {
  return {
    state: lookup.state,
    ctas: lookup.ctas.map((cta) => ({
      kind: cta.kind,
      keyCost: cta.keyCost,
      endpoint: cta.endpoint,
    })),
  };
}

function closedNetwork(state: 'identity_unavailable' | 'unknown'): ShopperNetworkLookup {
  return { state, ctas: [] };
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ShopperDealError('listingUrl must be a URL.', 400, 'invalid_request');
  }
  return value.trim();
}

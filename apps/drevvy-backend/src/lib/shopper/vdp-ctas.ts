import { ShopperDealError, isShopperListingId } from './deals';
import {
  resolveRooftopMatch,
  type RooftopDirectory,
} from '@/lib/dealer/rooftop-store';
import type { ListingDealerIdentity, RooftopMatch } from '@/lib/dealer/rooftop-match';

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

export async function resolveVdpCtas(
  body: unknown,
  deps: RooftopDirectory,
): Promise<VdpCtaSet> {
  const identity = readListingIdentityBody(body);
  const match = await resolveRooftopMatch(identity, deps);
  return ctasForMatch(match);
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ShopperDealError('listingUrl must be a URL.', 400, 'invalid_request');
  }
  return value.trim();
}

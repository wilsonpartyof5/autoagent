/**
 * Match a VDP / listing to an onboarded dealer-dashboard rooftop.
 *
 * Onboarded means a `dealerships` row that has at least one `user_dealerships`
 * membership (the older dealer portal login). PR #102's desk is still mock and
 * does not persist rooftops, so this is the live registry.
 *
 * A listing is in-network when any of these hit that rooftop, in this order:
 *   1. MarketCheck dealer id
 *   2. Normalized listing / VDP URL host (and path prefix when the rooftop URL has one)
 *   3. Normalized dealer website domain
 *
 * Off-network listings must not open a dealer conversation.
 */

export const IN_NETWORK_CHANNEL = 'in_app_message' as const;

const FIRST_NAME = /^[A-Za-z][A-Za-z'-]{0,39}$/;

/** First token only. Never last name, email, or phone. */
export function shopperFirstNameOnly(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const first = raw.trim().split(/\s+/)[0] ?? '';
  if (!FIRST_NAME.test(first)) return null;
  if (/[@\d]/.test(first)) return null;
  return first;
}

/** Dealer-facing opener. The in-network dealer sees first name only. Message-only. */
export function inNetworkOpener(firstName: string | null | undefined): string {
  const who = shopperFirstNameOnly(firstName) ?? 'A shopper';
  return `${who} is asking in Drevvy chat for your itemized best out-the-door price on this car, including taxes, fees, and add-ons at your signup terms.`;
}

export const IN_NETWORK_OPENER = inNetworkOpener(null);

export type MatchMethod = 'marketcheck_dealer_id' | 'listing_url' | 'dealer_domain';

export type OnboardedRooftop = {
  id: string;
  name: string;
  marketcheckDealerId: string | null;
  websiteUrl: string | null;
};

export type ListingDealerIdentity = {
  listingId?: string | null;
  listingUrl?: string | null;
  dealerWebsite?: string | null;
  marketcheckDealerId?: string | number | null;
};

export type RooftopMatch =
  | {
    matched: true;
    network: 'in_network';
    rooftop: OnboardedRooftop;
    method: MatchMethod;
    channel: typeof IN_NETWORK_CHANNEL;
    shopperKnown: true;
    opener: string;
  }
  | {
    matched: false;
    network: 'off_network';
    rooftop: null;
    method: null;
    channel: null;
    shopperKnown: false;
    opener: null;
  };

export function parseHttpUrl(raw: string | null | undefined): URL | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

/** Lowercase host, no leading www, no trailing dot. */
export function normalizeHost(raw: string | null | undefined): string | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  let host = url.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host.startsWith('www.')) host = host.slice(4);
  return host || null;
}

/**
 * Host + pathname, lowercase, no query/hash, no trailing slash.
 * Used to compare a VDP URL to a rooftop website.
 */
export function normalizeListingUrl(raw: string | null | undefined): string | null {
  const url = parseHttpUrl(raw);
  const host = normalizeHost(raw);
  if (!url || !host) return null;
  const path = url.pathname.replace(/\/+$/, '').toLowerCase();
  return path && path !== '/' ? `${host}${path}` : host;
}

export function normalizeMarketcheckDealerId(
  raw: string | number | null | undefined,
): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
}

export function matchOnboardedRooftop(
  identity: ListingDealerIdentity,
  rooftops: readonly OnboardedRooftop[],
): RooftopMatch {
  if (rooftops.length === 0) return offNetwork();

  const dealerId = normalizeMarketcheckDealerId(identity.marketcheckDealerId);
  if (dealerId) {
    const byId = rooftops.find(
      (rooftop) => normalizeMarketcheckDealerId(rooftop.marketcheckDealerId) === dealerId,
    );
    if (byId) return inNetwork(byId, 'marketcheck_dealer_id');
  }

  const listingHost = normalizeHost(identity.listingUrl);
  const listingNorm = normalizeListingUrl(identity.listingUrl);
  if (listingHost && listingNorm) {
    const byListing = rooftops.find((rooftop) => urlMatchesRooftop(listingHost, listingNorm, rooftop.websiteUrl));
    if (byListing) return inNetwork(byListing, 'listing_url');
  }

  const dealerHost = normalizeHost(identity.dealerWebsite);
  const dealerNorm = normalizeListingUrl(identity.dealerWebsite);
  if (dealerHost && dealerNorm) {
    const byDomain = rooftops.find((rooftop) => urlMatchesRooftop(dealerHost, dealerNorm, rooftop.websiteUrl));
    if (byDomain) return inNetwork(byDomain, 'dealer_domain');
  }

  return offNetwork();
}

export function mergeListingIdentity(
  ...parts: Array<ListingDealerIdentity | null | undefined>
): ListingDealerIdentity {
  const merged: ListingDealerIdentity = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.listingId && !merged.listingId) merged.listingId = part.listingId;
    if (part.listingUrl && !merged.listingUrl) merged.listingUrl = part.listingUrl;
    if (part.dealerWebsite && !merged.dealerWebsite) merged.dealerWebsite = part.dealerWebsite;
    if (part.marketcheckDealerId != null && part.marketcheckDealerId !== '' && merged.marketcheckDealerId == null) {
      merged.marketcheckDealerId = part.marketcheckDealerId;
    }
  }
  return merged;
}

function urlMatchesRooftop(
  listingHost: string,
  listingNorm: string,
  rooftopWebsite: string | null,
): boolean {
  const rooftopHost = normalizeHost(rooftopWebsite);
  const rooftopNorm = normalizeListingUrl(rooftopWebsite);
  if (!rooftopHost || !rooftopNorm) return false;
  if (listingHost !== rooftopHost) return false;
  if (rooftopNorm === rooftopHost) return true;
  return listingNorm === rooftopNorm || listingNorm.startsWith(`${rooftopNorm}/`);
}

function inNetwork(rooftop: OnboardedRooftop, method: MatchMethod): RooftopMatch {
  return {
    matched: true,
    network: 'in_network',
    rooftop,
    method,
    channel: IN_NETWORK_CHANNEL,
    shopperKnown: true,
    opener: inNetworkOpener(null),
  };
}

function offNetwork(): RooftopMatch {
  return {
    matched: false,
    network: 'off_network',
    rooftop: null,
    method: null,
    channel: null,
    shopperKnown: false,
    opener: null,
  };
}

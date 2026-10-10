/**
 * Removes rooftop identity from shopper inventory JSON.
 *
 * Kept: price, year/make/model/trim, mileage, condition, listing id, VIN,
 * photos, city/state, latitude/longitude, days on market, and other vehicle
 * specs already on the payload.
 *
 * Redacted: dealer name is always an empty string because the current shopper
 * decoder requires that key. Phone, email, website, street address, hours,
 * ratings, review counts, dealer ids, and sales staff are omitted. Seller
 * comments, descriptions, feature blurbs, and the assistant message are
 * scrubbed for those values plus any phone number, email, or web address.
 * Photo URLs are left unchanged.
 */
export function redactShopperDealerIdentity<T>(payload: T): T {
  const ctx = createContext();
  collect(payload, ctx, false);
  ctx.phrases = [...ctx.phraseSet].sort((a, b) => b.length - a.length);
  return scrub(payload, ctx, 'plain') as T;
}

const BLANK_NAME_KEYS = new Set(['dealername', 'dealer_name']);

const DROPPED_KEYS = new Set([
  'dealerphone',
  'dealer_phone',
  'phone',
  'phone_formatted',
  'dealerwebsite',
  'dealer_website',
  'website',
  'dealeraddress',
  'dealer_address',
  'street',
  'address',
  'email',
  'dealeremail',
  'dealer_email',
  'selleremail',
  'seller_email',
  'salesperson',
  'salespersonid',
  'salesperson_id',
  'salesstaff',
  'sales_staff',
  'dealerhours',
  'dealer_hours',
  'hours',
  'dealerid',
  'dealer_id',
  'sellername',
  'seller_name',
  'dealerrating',
  'dealer_rating',
  'dealerreviewcount',
  'dealer_review_count',
]);

const ADDRESS_KEYS = new Set(['dealeraddress', 'dealer_address', 'street', 'address']);

const DEALER_OBJECT_KEYS = new Set(['dealer', 'seller', 'rooftop', 'dealership']);

const DEALER_KEEP_KEYS = new Set(['city', 'state', 'latitude', 'longitude', 'lat', 'lng']);

const TEXT_KEYS = new Set([
  'sellercomments',
  'seller_comments',
  'description',
  'assistantmessage',
  'assistant_message',
  'features',
]);

const PHOTO_KEYS = new Set([
  'thumbnailurl',
  'thumbnail_url',
  'primaryphotourl',
  'primary_photo_url',
  'photourl',
  'photo_url',
  'photourls',
  'photo_urls',
  'imageurl',
  'image_url',
  'imageurls',
  'image_urls',
]);

const VIDEO_KEYS = new Set(['videourl', 'video_url']);

/** Vehicle facts and map fields. Their text is never rewritten. */
const PROTECTED_KEYS = new Set([
  'id',
  'vin',
  'listingid',
  'listing_id',
  'year',
  'make',
  'model',
  'trim',
  'condition',
  'bodytype',
  'body_type',
  'exteriorcolor',
  'exterior_color',
  'interiorcolor',
  'interior_color',
  'drivetrain',
  'fueltype',
  'fuel_type',
  'transmission',
  'engine',
  'powertraintype',
  'powertrain_type',
  'dealercity',
  'dealer_city',
  'dealerstate',
  'dealer_state',
  'city',
  'state',
  'enrichedat',
  'enriched_at',
  'code',
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'.,);:!?]+/gi;

type StringMode = 'plain' | 'text' | 'raw';

interface RedactionContext {
  phraseSet: Set<string>;
  phrases: string[];
  websiteHosts: Set<string>;
}

function createContext(): RedactionContext {
  return { phraseSet: new Set(), phrases: [], websiteHosts: new Set() };
}

function collect(value: unknown, ctx: RedactionContext, parentIsDealer: boolean, key?: string): void {
  if (typeof value === 'string') {
    if (key && (isIdentityKey(key) || (parentIsDealer && !DEALER_KEEP_KEYS.has(key)))) {
      addPhrase(ctx, value, key);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, ctx, parentIsDealer);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [childKey, child] of Object.entries(value)) {
    const normalized = childKey.toLowerCase();
    if (DEALER_OBJECT_KEYS.has(normalized)) {
      collect(child, ctx, true);
      continue;
    }
    collect(child, ctx, parentIsDealer, normalized);
  }
}

function isIdentityKey(key: string): boolean {
  return BLANK_NAME_KEYS.has(key) || DROPPED_KEYS.has(key);
}

function addPhrase(ctx: RedactionContext, value: string, key: string): void {
  const trimmed = value.trim();
  if (trimmed.length < 4 || /^unknown dealer$/i.test(trimmed)) return;

  ctx.phraseSet.add(trimmed);
  if (ADDRESS_KEYS.has(key)) {
    const street = trimmed.split(',')[0]?.trim() ?? '';
    if (street.length >= 8 && street !== trimmed) ctx.phraseSet.add(street);
  }

  const host = websiteHost(trimmed);
  if (!host) return;
  ctx.websiteHosts.add(host);
  ctx.phraseSet.add(host);
}

function websiteHost(value: string): string | null {
  const trimmed = value.trim();
  let candidate: string | null = null;
  if (/^https?:\/\//i.test(trimmed)) candidate = trimmed;
  else if (/^www\./i.test(trimmed)) candidate = `https://${trimmed}`;
  else if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(trimmed)) candidate = `https://${trimmed}`;
  if (!candidate) return null;

  try {
    const host = new URL(candidate).hostname.replace(/^www\./i, '').toLowerCase();
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

function scrub(value: unknown, ctx: RedactionContext, mode: StringMode): unknown {
  if (typeof value === 'string') {
    if (mode === 'raw') return value;
    return scrubText(value, ctx, mode === 'text');
  }
  if (Array.isArray(value)) return value.map((item) => scrub(item, ctx, mode));
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();

    if (DEALER_OBJECT_KEYS.has(normalized)) {
      const dealer = scrubDealerObject(child);
      if (Object.keys(dealer).length > 0) out[key] = dealer;
      continue;
    }
    if (BLANK_NAME_KEYS.has(normalized)) {
      out[key] = '';
      continue;
    }
    if (DROPPED_KEYS.has(normalized)) continue;
    if (VIDEO_KEYS.has(normalized) && typeof child === 'string') {
      const host = websiteHost(child);
      if (host && ctx.websiteHosts.has(host)) continue;
      out[key] = child;
      continue;
    }
    if (PHOTO_KEYS.has(normalized) || PROTECTED_KEYS.has(normalized)) {
      out[key] = scrub(child, ctx, 'raw');
      continue;
    }

    const nextMode: StringMode = TEXT_KEYS.has(normalized) ? 'text' : mode === 'text' ? 'text' : 'plain';
    out[key] = scrub(child, ctx, nextMode);
  }
  return out;
}

function scrubDealerObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!DEALER_KEEP_KEYS.has(key.toLowerCase())) continue;
    out[key] = child;
  }
  return out;
}

function scrubText(input: string, ctx: RedactionContext, contactPatterns: boolean): string {
  let text = input;
  for (const phrase of ctx.phrases) {
    text = text.replace(new RegExp(escapeRegExp(phrase), 'gi'), '');
  }
  if (contactPatterns) {
    text = text.replace(EMAIL_PATTERN, '').replace(PHONE_PATTERN, '').replace(URL_PATTERN, '');
  }
  return text.replace(/[^\S\n]{2,}/g, ' ').replace(/[ \t]+([,.;:!?])/g, '$1').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

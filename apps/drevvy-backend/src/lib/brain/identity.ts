/**
 * Stable contact identity for one shopper, one car, and one dealer.
 * The email alias, its sending domain, and the text number are chosen once.
 * A later send reads the same row so the dealer CRM does not open a second lead.
 * A dealer keeps one sending domain. New dealers are spread across the list.
 */

import { normalizePhone } from './telnyx';

export const DEFAULT_ALIAS_DOMAINS = [
  'offers.drevvy.com',
  'deals.drevvy.com',
  'quotes.drevvy.com',
  'buyers.drevvy.com',
] as const;

/** First default domain. Assignment passes an explicit domain instead. */
export const ALIAS_DOMAIN = DEFAULT_ALIAS_DOMAINS[0];
export const DEFAULT_COOLDOWN_DAYS = 90;
export const DEFAULT_LOW_WATERMARK = 2;

const FIRST_NAME = /^[A-Za-z][A-Za-z .'-]{0,39}$/;
const TAG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ALIAS_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$/;

export type ConversationIdentity = {
  id: string;
  dealId: string;
  dealerId: string;
  shopperId: string;
  shopperFirstName: string;
  emailAlias: string;
  aliasDomain: string;
  smsNumberE164: string;
  voiceNumberE164: string | null;
  lockedAt: string;
  createdAt: string;
  isTest: boolean;
  endedAt: string | null;
};

export type DealerDomainAssignment = {
  dealerId: string;
  domain: string;
};

export type PoolNumber = {
  phoneE164: string;
  status: 'active' | 'retired';
  isTest: boolean;
  lastAssignedAt: string | null;
};

export type SmsAssignment = {
  dealerId: string;
  shopperId: string;
  smsNumberE164: string;
  endedAt: string | null;
};

export type OutboundEnvelope = {
  from: string;
  replyTo: string | null;
  displayName: string | null;
  conversationId: string | null;
};

export function readShopperFirstName(
  profileFirst: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  domains: readonly string[] = DEFAULT_ALIAS_DOMAINS,
): string | null {
  const candidates = [
    profileFirst,
    metadataString(metadata, 'first_name'),
    metadataString(metadata, 'given_name'),
    metadataString(metadata, 'firstName'),
    firstToken(metadataString(metadata, 'full_name')),
    firstToken(metadataString(metadata, 'name')),
  ];
  for (const candidate of candidates) {
    const name = emailDisplayName(candidate ?? '', domains);
    if (name) return name;
  }
  return null;
}

export function emailDisplayName(firstName: string, domains: readonly string[] = DEFAULT_ALIAS_DOMAINS): string | null {
  const trimmed = firstName.trim();
  if (!FIRST_NAME.test(trimmed)) return null;
  if (/[@\d]/.test(trimmed)) return null;
  const slug = aliasSlug(trimmed);
  const brand = brandWordPattern(domains);
  if (!slug || brand.test(trimmed) || brand.test(slug)) return null;
  return trimmed;
}

export function aliasSlug(firstName: string): string | null {
  const slug = firstName.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
  if (!slug) return null;
  return slug.slice(0, 20);
}

export function randomAliasTag(random: () => number = Math.random): string {
  const length = 4 + Math.min(2, Math.floor(random() * 3));
  let tag = '';
  for (let index = 0; index < length; index += 1) {
    const pick = Math.min(TAG_ALPHABET.length - 1, Math.floor(random() * TAG_ALPHABET.length));
    tag += TAG_ALPHABET[pick];
  }
  return tag;
}

export function buildEmailAlias(
  firstName: string,
  tag: string,
  domain: string = ALIAS_DOMAIN,
  domains: readonly string[] = DEFAULT_ALIAS_DOMAINS,
): string | null {
  const slug = aliasSlug(firstName);
  if (!slug) return null;
  if (!/^[a-z0-9]{4,6}$/.test(tag)) return null;
  const host = normalizeAliasDomain(domain);
  if (!host) return null;
  const brand = brandWordPattern(domains);
  if (brand.test(firstName) || brand.test(slug) || brand.test(tag)) return null;
  return `${slug}.${tag}@${host}`;
}

/** A single-label subdomain of drevvy.com. The apex domain is not a sender. */
export function normalizeAliasDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!ALIAS_DOMAIN_PATTERN.test(domain)) return null;
  return domain;
}

export function aliasDomainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return normalizeAliasDomain(email.slice(at + 1));
}

/** Drop blanks, the apex, and any host that is not a drevvy.com subdomain. */
export function parseAliasDomains(value: string | readonly string[] | null | undefined): string[] {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const domains: string[] = [];
  for (const part of parts) {
    const domain = normalizeAliasDomain(String(part));
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

/**
 * Env wins when it lists at least one sending domain. Otherwise the settings
 * row. Otherwise the four Telnyx domains.
 */
export function resolveAliasDomains(input: {
  env?: string | null;
  settings?: string | readonly string[] | null;
}): string[] {
  const fromEnv = parseAliasDomains(input.env);
  if (input.env?.trim() && fromEnv.length > 0) return fromEnv;
  const fromSettings = parseAliasDomains(input.settings);
  if (fromSettings.length > 0) return fromSettings;
  return [...DEFAULT_ALIAS_DOMAINS];
}

/** Domain labels plus drevvy, so a local part does not read as brand mail. */
export function brandWordPattern(domains: readonly string[] = DEFAULT_ALIAS_DOMAINS): RegExp {
  const labels = new Set<string>(['drevvy']);
  for (const domain of domains) {
    const label = normalizeAliasDomain(domain)?.split('.')[0];
    if (label) labels.add(label);
  }
  const body = [...labels].sort().map(escapeRegExp).join('|');
  return new RegExp(body, 'i');
}

/**
 * One domain per dealer. An existing assignment is kept, even when that
 * domain is no longer in the configured list. A new dealer takes a domain
 * with the fewest dealers. Ties use a stable hash so the same dealer id
 * keeps resolving to the same domain for a given count snapshot.
 */
export function pickAliasDomain(input: {
  dealerId: string;
  domains: readonly string[];
  assigned: readonly DealerDomainAssignment[];
}): string {
  const usable = parseAliasDomains(input.domains);
  const domains = usable.length > 0 ? usable : [...DEFAULT_ALIAS_DOMAINS];
  const existing = input.assigned.find((row) => row.dealerId === input.dealerId);
  const kept = existing ? normalizeAliasDomain(existing.domain) : null;
  if (kept) return kept;

  const counts = new Map<string, Set<string>>(domains.map((domain) => [domain, new Set()]));
  for (const row of input.assigned) {
    const domain = normalizeAliasDomain(row.domain);
    const dealers = domain ? counts.get(domain) : undefined;
    if (dealers) dealers.add(row.dealerId);
  }
  const min = Math.min(...[...counts.values()].map((dealers) => dealers.size));
  const tied = domains.filter((domain) => counts.get(domain)?.size === min);
  return tied[stableIndex(input.dealerId, tied.length)] ?? domains[0];
}

/** Local part Telnyx accepts on POST /v2/email_inboxes for a sending-domain alias. */
export function emailInboxUsername(alias: string): string | null {
  const email = normalizeEmailAddress(alias);
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  if (!normalizeAliasDomain(email.slice(at + 1))) return null;
  if (local.length < 1 || local.length > 64) return null;
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(local)) return null;
  return local;
}

export function formatMailbox(displayName: string, email: string): string {
  const safe = displayName.replace(/["\\<>]/g, '').trim();
  return `"${safe}" <${email}>`;
}

export function normalizeEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const wrapped = value.match(/<([^>]+)>/);
  const raw = (wrapped?.[1] ?? value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

/** Keep the row already stored. A new draft must not replace its addresses. */
export function resolveAssignment(
  existing: ConversationIdentity | null,
  draft: ConversationIdentity,
): ConversationIdentity {
  return existing ?? draft;
}

export function pickSmsNumber(input: {
  pool: PoolNumber[];
  assignments: SmsAssignment[];
  dealerId: string;
  shopperId: string;
  now: Date;
  cooldownDays: number;
  test: boolean;
}): { phoneE164: string } | { error: 'none_available' } {
  const cooldownMs = input.cooldownDays * 24 * 60 * 60 * 1000;
  const ranked = input.pool
    .filter((number) => number.status === 'active' && number.isTest === input.test)
    .sort((left, right) => {
      const leftAt = left.lastAssignedAt ? Date.parse(left.lastAssignedAt) : 0;
      const rightAt = right.lastAssignedAt ? Date.parse(right.lastAssignedAt) : 0;
      if (leftAt !== rightAt) return leftAt - rightAt;
      return left.phoneE164.localeCompare(right.phoneE164);
    });

  for (const number of ranked) {
    const rows = input.assignments.filter(
      (row) => row.smsNumberE164 === number.phoneE164 && row.dealerId === input.dealerId,
    );
    if (rows.some((row) => row.endedAt == null)) continue;
    const cooling = rows.some((row) => {
      if (row.shopperId === input.shopperId) return false;
      if (row.endedAt == null) return true;
      return input.now.getTime() - Date.parse(row.endedAt) < cooldownMs;
    });
    if (cooling) continue;
    return { phoneE164: number.phoneE164 };
  }
  return { error: 'none_available' };
}

export function smsPoolHealth(
  pool: PoolNumber[],
  watermark: number,
  test: boolean,
): { active: number; watermark: number; low: boolean } {
  const active = pool.filter((number) => number.status === 'active' && number.isTest === test).length;
  return { active, watermark, low: active <= watermark };
}

/** Admin purchase flag: the live pool is small, or a send was held because nothing was free. */
export function purchaseFlagVisible(health: { low: boolean }, purchaseNeeded: boolean): boolean {
  return health.low || purchaseNeeded;
}

export function pickVoiceNumber(
  numbers: { state: string; phoneE164: string }[],
  state: string | null | undefined,
): string | null {
  if (!state) return null;
  const code = state.trim().toUpperCase();
  return numbers.find((number) => number.state.trim().toUpperCase() === code)?.phoneE164 ?? null;
}

export function selectSender(input: {
  channel: 'email' | 'sms' | 'voice';
  identity: ConversationIdentity | null;
  testMode: boolean;
  fallback?: {
    email?: string | null;
    sms?: string | null;
    voice?: string | null;
    firstName?: string | null;
  };
}): OutboundEnvelope | { error: string } {
  if (input.identity) {
    const displayName = emailDisplayName(input.identity.shopperFirstName);
    if (!displayName) return { error: 'The shopper first name cannot be used as a display name.' };
    if (input.channel === 'email') {
      return {
        from: formatMailbox(displayName, input.identity.emailAlias),
        replyTo: input.identity.emailAlias,
        displayName,
        conversationId: input.identity.id,
      };
    }
    if (input.channel === 'sms') {
      return {
        from: input.identity.smsNumberE164,
        replyTo: null,
        displayName,
        conversationId: input.identity.id,
      };
    }
    if (!input.identity.voiceNumberE164) {
      return { error: 'This conversation has no caller ID for the dealer state.' };
    }
    return {
      from: input.identity.voiceNumberE164,
      replyTo: null,
      displayName,
      conversationId: input.identity.id,
    };
  }

  if (!input.testMode) return { error: 'A conversation identity is required.' };
  const fallback = input.fallback ?? {};
  if (input.channel === 'email') {
    const email = normalizeEmailAddress(fallback.email);
    if (!email) return { error: 'Test mode needs DREVVY_EMAIL.' };
    const displayName = emailDisplayName(fallback.firstName ?? '') ?? 'Shopper';
    return {
      from: formatMailbox(displayName, email),
      replyTo: email,
      displayName,
      conversationId: null,
    };
  }
  // The caller ID and the reply text number are different numbers.
  // Voice uses only the caller ID. Text uses only the text number.
  const phone = normalizePhone(input.channel === 'voice' ? fallback.voice : fallback.sms);
  if (!phone) {
    return { error: input.channel === 'voice' ? 'Test mode needs a caller ID.' : 'Test mode needs DREVVY_TEXT_NUMBER.' };
  }
  return { from: phone, replyTo: null, displayName: null, conversationId: null };
}

/** True when copy includes the caller-ID digits. The voice agent must not do this. */
export function voiceNumberLeaks(text: string, voiceNumber: string | null): boolean {
  if (!voiceNumber) return false;
  const digits = voiceNumber.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length < 10) return false;
  return text.replace(/\D/g, '').includes(national);
}

export function parsePoolNumber(input: {
  phone: string;
  label: string;
  isTest: boolean;
}): { phoneE164: string; label: string; isTest: boolean } | { error: string } {
  const phoneE164 = normalizePhone(input.phone);
  if (!phoneE164) return { error: 'Enter a valid text number.' };
  const label = input.label.trim();
  if (!label || label.length > 80) return { error: 'Add a short label for this number.' };
  return { phoneE164, label, isTest: input.isTest };
}

export function parseVoiceNumber(input: {
  state: string;
  phone: string;
  label: string;
}): { state: string; phoneE164: string; label: string } | { error: string } {
  const state = input.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return { error: 'Use a two-letter state code.' };
  const phoneE164 = normalizePhone(input.phone);
  if (!phoneE164) return { error: 'Enter a valid caller ID.' };
  const label = input.label.trim();
  if (label.length > 80) return { error: 'The label is too long.' };
  return { state, phoneE164, label };
}

export function parseIdentitySettings(input: {
  cooldownDays: string;
  watermark: string;
}): { cooldownDays: number; watermark: number } | { error: string } {
  const cooldownDays = Number(input.cooldownDays);
  const watermark = Number(input.watermark);
  if (!Number.isInteger(cooldownDays) || cooldownDays < 0 || cooldownDays > 3650) {
    return { error: 'Cooldown days must be a whole number from 0 to 3650.' };
  }
  if (!Number.isInteger(watermark) || watermark < 0 || watermark > 1000) {
    return { error: 'The low-pool flag must be a whole number from 0 to 1000.' };
  }
  return { cooldownDays, watermark };
}

export type RouteIdentity = {
  id: string;
  dealId: string;
  dealerId: string;
  emailAlias: string;
  smsNumberE164: string;
  endedAt: string | null;
};

export type RouteParty = {
  conversationId: string;
  channel: 'sms' | 'email';
  ourAddress: string;
  theirAddress: string;
};

export type RouteThread = {
  conversationId: string;
  messageId: string;
};

export type InboundRoute = {
  conversationId: string;
  dealId: string;
  dealerId: string;
  via: 'email_alias' | 'sms_pair' | 'thread' | 'client_state';
};

export function extractMessageIds(value: string | null | undefined): string[] {
  if (!value) return [];
  const wrapped = value.match(/<[^>\s]+>/g) ?? [];
  const bare = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.includes('@') && !part.startsWith('<'));
  const ids = [...wrapped, ...bare.map((part) => `<${part.replace(/^<|>$/g, '')}>`)];
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

export function threadMessageId(conversationId: string, nonce: string, domain: string): string {
  const clean = nonce.replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'msg';
  const suffix = conversationId.replace(/-/g, '').slice(0, 12) || 'conv';
  const host = normalizeAliasDomain(domain) ?? ALIAS_DOMAIN;
  return `<${clean}.${suffix}@${host}>`;
}

export function routeInbound(input: {
  channel: 'email' | 'sms' | 'call' | 'voicemail' | null;
  to: string | null;
  from: string | null;
  inReplyTo: string | null;
  references: string | null;
  clientState: { conversationId?: string; dealId?: string; dealerId?: string };
  identities: RouteIdentity[];
  parties: RouteParty[];
  threads: RouteThread[];
}): InboundRoute | null {
  const byId = new Map(input.identities.map((row) => [row.id, row]));

  if (input.channel === 'email' || input.channel == null) {
    // Match the full stored alias. That address already carries its sending domain,
    // so offers, deals, quotes, buyers, and any later configured domain all route.
    const tos = addressList(input.to, 'email');
    const aliasHit = chooseRoute(input.identities.filter((row) => tos.includes(row.emailAlias.toLowerCase())));
    if (aliasHit) return finishRoute(aliasHit, 'email_alias');
  }

  const phoneChannel = input.channel === 'sms' || input.channel === 'call' || input.channel === 'voicemail' || input.channel == null;
  if (phoneChannel) {
    const tos = addressList(input.to, 'sms');
    const froms = addressList(input.from, 'sms');
    const partyIds = input.parties
      .filter((party) => party.channel === 'sms' && tos.includes(party.ourAddress) && froms.includes(party.theirAddress))
      .map((party) => party.conversationId);
    const smsHit = chooseRoute(partyIds.map((id) => byId.get(id)).filter((row): row is RouteIdentity => Boolean(row)));
    if (smsHit) return finishRoute(smsHit, 'sms_pair');
  }

  const messageIds = [...extractMessageIds(input.inReplyTo), ...extractMessageIds(input.references)];
  if (messageIds.length > 0) {
    const threadIds = input.threads
      .filter((thread) => messageIds.includes(thread.messageId.toLowerCase()))
      .map((thread) => thread.conversationId);
    const threadHit = chooseRoute(threadIds.map((id) => byId.get(id)).filter((row): row is RouteIdentity => Boolean(row)));
    if (threadHit) return finishRoute(threadHit, 'thread');
  }

  if (input.clientState.conversationId) {
    const direct = byId.get(input.clientState.conversationId);
    if (direct) return finishRoute(direct, 'client_state');
  }
  if (input.clientState.dealId) {
    const matches = input.identities.filter((row) => {
      if (row.dealId !== input.clientState.dealId) return false;
      if (input.clientState.dealerId && row.dealerId !== input.clientState.dealerId) return false;
      return true;
    });
    const stateHit = chooseRoute(matches);
    if (stateHit) return finishRoute(stateHit, 'client_state');
  }
  return null;
}

export function addressList(value: string | null | undefined, channel: 'email' | 'sms'): string[] {
  if (!value) return [];
  const parts = value.split(',');
  const normalized = parts
    .map((part) => (channel === 'sms' ? normalizePhone(part) : normalizeEmailAddress(part)))
    .filter((part): part is string => Boolean(part));
  return [...new Set(normalized)];
}

function finishRoute(row: RouteIdentity, via: InboundRoute['via']): InboundRoute {
  return { conversationId: row.id, dealId: row.dealId, dealerId: row.dealerId, via };
}

function chooseRoute(matches: RouteIdentity[]): RouteIdentity | null {
  const unique = [...new Map(matches.map((row) => [row.id, row])).values()];
  if (unique.length === 0) return null;
  const live = unique.filter((row) => row.endedAt == null);
  if (live.length === 1) return live[0];
  if (live.length > 1) return null;
  if (unique.length === 1) return unique[0];
  return null;
}

function stableIndex(key: string, size: number): number {
  if (size <= 1) return 0;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function firstToken(value: string | null): string | null {
  if (!value) return null;
  const token = value.trim().split(/\s+/)[0];
  return token || null;
}

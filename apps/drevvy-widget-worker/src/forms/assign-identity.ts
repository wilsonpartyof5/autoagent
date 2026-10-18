/**
 * Assign the conversation identity before a live widget send.
 * Rules match ensureConversationIdentity: one live text number per dealer,
 * one sending domain per dealer, cooldown before a different shopper reuses
 * a number, and the stored alias and number do not change.
 * DREVVY_TEST_MODE does not call this.
 * Domain helpers match apps/drevvy-backend/src/lib/brain/identity.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ConversationContact } from './identity';

const DEFAULT_ALIAS_DOMAINS = [
  'offers.drevvy.com',
  'deals.drevvy.com',
  'quotes.drevvy.com',
  'buyers.drevvy.com',
];
const TAG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const FIRST_NAME = /^[A-Za-z][A-Za-z .'-]{0,39}$/;
const ALIAS_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$/;
const DEFAULT_COOLDOWN_DAYS = 90;

type DealerDomain = { dealerId: string; domain: string };

type PoolNumber = {
  phoneE164: string;
  status: 'active' | 'retired';
  isTest: boolean;
  lastAssignedAt: string | null;
};

type SmsAssignment = {
  dealerId: string;
  shopperId: string;
  smsNumberE164: string;
  endedAt: string | null;
};

export type EnsureContactResult =
  | ConversationContact
  | { error: string; held: true; purchaseFlag: boolean };

export async function ensureConversationContact(
  client: SupabaseClient,
  input: { dealId: string; dealerId: string; random?: () => number },
): Promise<EnsureContactResult> {
  const existing = await loadExisting(client, input.dealId, input.dealerId);
  if (existing) return existing;

  const deal = await loadDeal(client, input.dealId);
  if (!deal.shopperId) return hold('The deal has no shopper.', false);

  const settings = await loadSettings(client);
  const firstName = await loadShopperFirstName(client, deal.shopperId, settings.aliasDomains);
  if (!firstName) return hold('The shopper first name is not on the profile.', await purchaseFlag(client));

  const [pool, assignments, voices, dealerDomains] = await Promise.all([
    loadPool(client),
    loadAssignments(client, input.dealerId),
    loadVoices(client),
    loadDealerDomains(client),
  ]);
  const voiceNumberE164 = pickVoiceNumber(voices, deal.state);
  const random = input.random ?? Math.random;
  let assigned = dealerDomains;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const domain = pickAliasDomain({
      dealerId: input.dealerId,
      domains: settings.aliasDomains,
      assigned,
    });
    const picked = pickSmsNumber({
      pool,
      assignments,
      dealerId: input.dealerId,
      shopperId: deal.shopperId,
      now: new Date(),
      cooldownDays: settings.cooldownDays,
    });
    if ('error' in picked) {
      await markPurchaseNeeded(client);
      return hold('No text number is free for this dealer. Purchase another Telnyx number.', true);
    }
    const alias = buildEmailAlias(firstName, randomAliasTag(random), domain, settings.aliasDomains);
    if (!alias) continue;

    const { data, error } = await client
      .from('conversation_identities')
      .insert({
        deal_id: input.dealId,
        dealer_id: input.dealerId,
        shopper_id: deal.shopperId,
        shopper_first_name: firstName,
        email_alias: alias,
        alias_domain: domain,
        sms_number_e164: picked.phoneE164,
        voice_number_e164: voiceNumberE164,
        is_test: false,
      })
      .select('shopper_first_name, email_alias, sms_number_e164')
      .single();

    if (!error && data?.shopper_first_name && data.email_alias && data.sms_number_e164) {
      const winner = await loadExisting(client, input.dealId, input.dealerId);
      return winner ?? {
        shopperFirst: data.shopper_first_name,
        emailAlias: data.email_alias,
        smsNumber: data.sms_number_e164,
      };
    }
    if (!error) return hold('Could not assign a conversation identity.', await purchaseFlag(client));

    const raced = await loadExisting(client, input.dealId, input.dealerId);
    if (raced) return raced;
    if (/sending domain/i.test(error.message ?? '')) {
      assigned = await loadDealerDomains(client);
      continue;
    }
    if (/email_alias/i.test(error.message ?? '')) continue;
    assignments.push({
      dealerId: input.dealerId,
      shopperId: `other-${attempt}`,
      smsNumberE164: picked.phoneE164,
      endedAt: null,
    });
  }
  return hold('Could not assign a conversation identity.', await purchaseFlag(client));
}

function hold(error: string, purchaseFlag: boolean): EnsureContactResult {
  return { error, held: true, purchaseFlag };
}

async function loadExisting(client: SupabaseClient, dealId: string, dealerId: string): Promise<ConversationContact | null> {
  const { data, error } = await client
    .from('conversation_identities')
    .select('shopper_first_name, email_alias, sms_number_e164')
    .eq('deal_id', dealId)
    .eq('dealer_id', dealerId)
    .maybeSingle();
  if (error || !data?.shopper_first_name || !data.email_alias || !data.sms_number_e164) return null;
  return {
    shopperFirst: data.shopper_first_name,
    emailAlias: data.email_alias,
    smsNumber: data.sms_number_e164,
  };
}

async function loadDeal(client: SupabaseClient, dealId: string): Promise<{ shopperId: string | null; state: string | null }> {
  const { data } = await client.from('shopper_deals').select('consumer_user_id, vehicle_snapshot').eq('id', dealId).maybeSingle();
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

async function loadShopperFirstName(client: SupabaseClient, shopperId: string, domains: readonly string[]): Promise<string | null> {
  const { data: profile } = await client.from('consumer_profiles').select('first_name').eq('user_id', shopperId).maybeSingle();
  let metadata: Record<string, unknown> | null = null;
  try {
    const { data } = await client.auth.admin.getUserById(shopperId);
    const raw = data.user?.user_metadata;
    if (raw && typeof raw === 'object') metadata = raw as Record<string, unknown>;
  } catch {
    metadata = null;
  }
  const name = readShopperFirstName(typeof profile?.first_name === 'string' ? profile.first_name : null, metadata, domains);
  if (name && profile && !profile.first_name) {
    await client.from('consumer_profiles').update({ first_name: name }).eq('user_id', shopperId).is('first_name', null);
  }
  return name;
}

async function loadSettings(client: SupabaseClient): Promise<{ cooldownDays: number; watermark: number; aliasDomains: string[] }> {
  const { data } = await client.from('identity_settings').select('sms_cooldown_days, sms_pool_low_watermark, alias_domains').eq('id', 1).maybeSingle();
  const settingsDomains = Array.isArray(data?.alias_domains)
    ? data.alias_domains.filter((item: unknown): item is string => typeof item === 'string')
    : null;
  return {
    cooldownDays: typeof data?.sms_cooldown_days === 'number' ? data.sms_cooldown_days : DEFAULT_COOLDOWN_DAYS,
    watermark: typeof data?.sms_pool_low_watermark === 'number' ? data.sms_pool_low_watermark : 2,
    aliasDomains: resolveAliasDomains({ env: process.env.ALIAS_DOMAINS, settings: settingsDomains }),
  };
}

async function loadDealerDomains(client: SupabaseClient): Promise<DealerDomain[]> {
  const side = await client.from('dealer_alias_domains').select('dealer_id, alias_domain');
  const sideRows = domainRows(side.error ? null : side.data);
  if (sideRows.length > 0) return sideRows;
  const identities = await client.from('conversation_identities').select('dealer_id, alias_domain, email_alias');
  return domainRows(identities.data);
}

async function loadPool(client: SupabaseClient): Promise<PoolNumber[]> {
  const { data } = await client.from('sms_number_pool').select('phone_e164, status, is_test, last_assigned_at');
  return (data ?? []).map((row) => ({
    phoneE164: row.phone_e164,
    status: row.status === 'retired' ? 'retired' : 'active',
    isTest: row.is_test === true,
    lastAssignedAt: row.last_assigned_at ?? null,
  }));
}

async function loadAssignments(client: SupabaseClient, dealerId: string): Promise<SmsAssignment[]> {
  const { data } = await client
    .from('conversation_identities')
    .select('dealer_id, shopper_id, sms_number_e164, ended_at')
    .eq('dealer_id', dealerId);
  return (data ?? []).map((row) => ({
    dealerId: row.dealer_id,
    shopperId: row.shopper_id,
    smsNumberE164: row.sms_number_e164,
    endedAt: row.ended_at,
  }));
}

async function loadVoices(client: SupabaseClient): Promise<{ state: string; phoneE164: string }[]> {
  const { data } = await client.from('voice_numbers').select('state_code, phone_e164');
  return (data ?? []).map((row) => ({ state: row.state_code, phoneE164: row.phone_e164 }));
}

async function markPurchaseNeeded(client: SupabaseClient): Promise<void> {
  await client.from('identity_settings').update({
    purchase_needed: true,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
}

async function purchaseFlag(client: SupabaseClient): Promise<boolean> {
  const [settings, pool] = await Promise.all([
    client.from('identity_settings').select('sms_pool_low_watermark, purchase_needed').eq('id', 1).maybeSingle(),
    loadPool(client),
  ]);
  const watermark = typeof settings.data?.sms_pool_low_watermark === 'number' ? settings.data.sms_pool_low_watermark : 2;
  const active = pool.filter((number) => number.status === 'active' && !number.isTest).length;
  return active <= watermark || settings.data?.purchase_needed === true;
}

function pickSmsNumber(input: {
  pool: PoolNumber[];
  assignments: SmsAssignment[];
  dealerId: string;
  shopperId: string;
  now: Date;
  cooldownDays: number;
}): { phoneE164: string } | { error: 'none_available' } {
  const cooldownMs = input.cooldownDays * 24 * 60 * 60 * 1000;
  const ranked = input.pool
    .filter((number) => number.status === 'active' && !number.isTest)
    .sort((left, right) => {
      const leftAt = left.lastAssignedAt ? Date.parse(left.lastAssignedAt) : 0;
      const rightAt = right.lastAssignedAt ? Date.parse(right.lastAssignedAt) : 0;
      if (leftAt !== rightAt) return leftAt - rightAt;
      return left.phoneE164.localeCompare(right.phoneE164);
    });
  for (const number of ranked) {
    const rows = input.assignments.filter((row) => row.smsNumberE164 === number.phoneE164 && row.dealerId === input.dealerId);
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

function pickVoiceNumber(numbers: { state: string; phoneE164: string }[], state: string | null): string | null {
  if (!state) return null;
  const code = state.trim().toUpperCase();
  return numbers.find((number) => number.state.trim().toUpperCase() === code)?.phoneE164 ?? null;
}

function readShopperFirstName(
  profileFirst: string | null,
  metadata: Record<string, unknown> | null,
  domains: readonly string[],
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
    const name = displayName(candidate ?? '', domains);
    if (name) return name;
  }
  return null;
}

function displayName(firstName: string, domains: readonly string[]): string | null {
  const trimmed = firstName.trim();
  if (!FIRST_NAME.test(trimmed)) return null;
  if (/[@\d]/.test(trimmed)) return null;
  const slug = trimmed.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
  const brand = brandWordPattern(domains);
  if (!slug || brand.test(trimmed) || brand.test(slug)) return null;
  return trimmed;
}

function buildEmailAlias(firstName: string, tag: string, domain: string, domains: readonly string[]): string | null {
  const slug = firstName.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase().slice(0, 20);
  const host = normalizeAliasDomain(domain);
  if (!slug || !host || !/^[a-z0-9]{4,6}$/.test(tag)) return null;
  const brand = brandWordPattern(domains);
  if (brand.test(firstName) || brand.test(slug) || brand.test(tag)) return null;
  return `${slug}.${tag}@${host}`;
}

function normalizeAliasDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!ALIAS_DOMAIN_PATTERN.test(domain)) return null;
  return domain;
}

function parseAliasDomains(value: string | readonly string[] | null | undefined): string[] {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const domains: string[] = [];
  for (const part of parts) {
    const domain = normalizeAliasDomain(String(part));
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

function resolveAliasDomains(input: { env?: string | null; settings?: readonly string[] | null }): string[] {
  const fromEnv = parseAliasDomains(input.env);
  if (input.env?.trim() && fromEnv.length > 0) return fromEnv;
  const fromSettings = parseAliasDomains(input.settings);
  if (fromSettings.length > 0) return fromSettings;
  return [...DEFAULT_ALIAS_DOMAINS];
}

function brandWordPattern(domains: readonly string[]): RegExp {
  const labels = new Set<string>(['drevvy']);
  for (const domain of domains) {
    const label = normalizeAliasDomain(domain)?.split('.')[0];
    if (label) labels.add(label);
  }
  const body = [...labels].sort().map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(body, 'i');
}

function pickAliasDomain(input: {
  dealerId: string;
  domains: readonly string[];
  assigned: readonly DealerDomain[];
}): string {
  const parsed = parseAliasDomains(input.domains);
  const domains = parsed.length > 0 ? parsed : [...DEFAULT_ALIAS_DOMAINS];
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

function stableIndex(key: string, size: number): number {
  if (size <= 1) return 0;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

function domainRows(data: unknown): DealerDomain[] {
  if (!Array.isArray(data)) return [];
  const rows: DealerDomain[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { dealer_id?: unknown; alias_domain?: unknown; email_alias?: unknown };
    const dealerId = typeof row.dealer_id === 'string' ? row.dealer_id : '';
    if (!dealerId) continue;
    const stored = typeof row.alias_domain === 'string' ? normalizeAliasDomain(row.alias_domain) : null;
    const email = typeof row.email_alias === 'string' ? row.email_alias : '';
    const at = email.lastIndexOf('@');
    const fromEmail = at >= 0 ? normalizeAliasDomain(email.slice(at + 1)) : null;
    const domain = stored ?? fromEmail;
    if (!domain) continue;
    rows.push({ dealerId, domain });
  }
  return rows;
}

function randomAliasTag(random: () => number): string {
  const length = 4 + Math.min(2, Math.floor(random() * 3));
  let tag = '';
  for (let index = 0; index < length; index += 1) {
    const pick = Math.min(TAG_ALPHABET.length - 1, Math.floor(random() * TAG_ALPHABET.length));
    tag += TAG_ALPHABET[pick];
  }
  return tag;
}

function metadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function firstToken(value: string | null): string | null {
  if (!value) return null;
  const token = value.trim().split(/\s+/)[0];
  return token || null;
}

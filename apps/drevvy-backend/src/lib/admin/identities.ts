import { createAdminClient } from '@/lib/supabase/admin';

import { endConversationIdentity } from '@/lib/brain/identity-store';
import {
  DEFAULT_ALIAS_DOMAINS,
  parseIdentitySettings,
  parsePoolNumber,
  parseVoiceNumber,
  purchaseFlagVisible,
  resolveAliasDomains,
  smsPoolHealth,
  type ConversationIdentity,
} from '@/lib/brain/identity';
import { mapIdentity } from '@/lib/brain/identity-store';
import type { TrafficFilter } from './outreach/types';

export type IdentityRow = {
  id: string;
  dealId: string;
  dealerId: string;
  shopperFirstName: string;
  emailAlias: string;
  aliasDomain: string;
  smsNumberE164: string;
  voiceNumberE164: string | null;
  isTest: boolean;
  endedAt: string | null;
  createdAt: string;
};

export type UnmatchedRow = {
  id: string;
  channel: string;
  fromAddress: string | null;
  toAddress: string | null;
  body: string | null;
  receivedAt: string;
  isTest: boolean;
};

export type PoolRow = {
  phoneE164: string;
  label: string;
  status: 'active' | 'retired';
  isTest: boolean;
  lastAssignedAt: string | null;
};

export type VoiceRow = {
  state: string;
  phoneE164: string;
  label: string;
};

export type IdentityAdmin = {
  configured: boolean;
  identities: IdentityRow[];
  unmatched: UnmatchedRow[];
  pool: PoolRow[];
  voices: VoiceRow[];
  cooldownDays: number;
  watermark: number;
  aliasDomains: string[];
  livePool: { active: number; watermark: number; low: boolean };
  purchaseFlag: boolean;
};

const EMPTY: IdentityAdmin = {
  configured: false,
  identities: [],
  unmatched: [],
  pool: [],
  voices: [],
  cooldownDays: 90,
  watermark: 2,
  aliasDomains: [...DEFAULT_ALIAS_DOMAINS],
  livePool: { active: 0, watermark: 2, low: false },
  purchaseFlag: false,
};

export async function loadIdentityAdmin(traffic: TrafficFilter): Promise<IdentityAdmin> {
  if (!storageConfigured()) return EMPTY;
  try {
    const admin = createAdminClient();
    let identitiesQuery = admin
      .from('conversation_identities')
      .select('id, deal_id, dealer_id, shopper_id, shopper_first_name, email_alias, alias_domain, sms_number_e164, voice_number_e164, locked_at, created_at, is_test, ended_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (traffic === 'live') identitiesQuery = identitiesQuery.eq('is_test', false);
    if (traffic === 'test') identitiesQuery = identitiesQuery.eq('is_test', true);
    let unmatchedQuery = admin
      .from('unmatched_inbound')
      .select('id, channel, from_address, to_address, body, received_at, is_test')
      .is('reviewed_at', null)
      .order('received_at', { ascending: false })
      .limit(50);
    if (traffic === 'live') unmatchedQuery = unmatchedQuery.eq('is_test', false);
    if (traffic === 'test') unmatchedQuery = unmatchedQuery.eq('is_test', true);

    const [identities, unmatched, pool, voices, settings] = await Promise.all([
      identitiesQuery,
      unmatchedQuery,
      admin.from('sms_number_pool').select('phone_e164, label, status, is_test, last_assigned_at').order('created_at', { ascending: true }),
      admin.from('voice_numbers').select('state_code, phone_e164, label').order('state_code'),
      admin.from('identity_settings').select('sms_cooldown_days, sms_pool_low_watermark, purchase_needed, alias_domains').eq('id', 1).maybeSingle(),
    ]);

    const poolRows: PoolRow[] = (pool.data ?? []).map((row) => ({
      phoneE164: row.phone_e164,
      label: row.label,
      status: row.status === 'retired' ? 'retired' : 'active',
      isTest: row.is_test === true,
      lastAssignedAt: row.last_assigned_at,
    }));
    const watermark = settings.data?.sms_pool_low_watermark ?? 2;
    const livePool = smsPoolHealth(poolRows, watermark, false);
    return {
      configured: true,
      identities: (identities.data ?? []).map((row) => publicIdentity(mapIdentity(row as Record<string, unknown>))),
      unmatched: (unmatched.data ?? []).map((row) => ({
        id: row.id,
        channel: row.channel,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        body: row.body,
        receivedAt: row.received_at,
        isTest: row.is_test === true,
      })),
      pool: poolRows,
      voices: (voices.data ?? []).map((row) => ({
        state: row.state_code,
        phoneE164: row.phone_e164,
        label: row.label,
      })),
      cooldownDays: settings.data?.sms_cooldown_days ?? 90,
      watermark,
      aliasDomains: resolveAliasDomains({
        env: process.env.ALIAS_DOMAINS,
        settings: Array.isArray(settings.data?.alias_domains)
          ? settings.data.alias_domains.filter((item: unknown): item is string => typeof item === 'string')
          : null,
      }),
      livePool,
      purchaseFlag: purchaseFlagVisible(livePool, settings.data?.purchase_needed === true),
    };
  } catch {
    return { ...EMPTY, configured: true };
  }
}

export async function loadIdentitiesForDeal(dealId: string): Promise<IdentityRow[]> {
  if (!storageConfigured()) return [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('conversation_identities')
      .select('id, deal_id, dealer_id, shopper_id, shopper_first_name, email_alias, alias_domain, sms_number_e164, voice_number_e164, locked_at, created_at, is_test, ended_at')
      .eq('deal_id', dealId);
    return (data ?? []).map((row) => publicIdentity(mapIdentity(row as Record<string, unknown>)));
  } catch {
    return [];
  }
}

export async function savePoolNumber(input: { phone: string; label: string; isTest: boolean }): Promise<{ error: string } | { ok: true }> {
  const parsed = parsePoolNumber(input);
  if ('error' in parsed) return parsed;
  if (!storageConfigured()) return { error: 'Identity storage is not configured.' };
  const admin = createAdminClient();
  const { error } = await admin.from('sms_number_pool').insert({
    phone_e164: parsed.phoneE164,
    label: parsed.label,
    status: 'active',
    is_test: parsed.isTest,
  });
  if (error) return { error: 'Could not add that text number.' };
  if (!parsed.isTest) {
    await admin.from('identity_settings').update({
      purchase_needed: false,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
  }
  return { ok: true };
}

export async function saveVoiceNumber(input: { state: string; phone: string; label: string }): Promise<{ error: string } | { ok: true }> {
  const parsed = parseVoiceNumber(input);
  if ('error' in parsed) return parsed;
  if (!storageConfigured()) return { error: 'Identity storage is not configured.' };
  const admin = createAdminClient();
  const { error } = await admin.from('voice_numbers').upsert({
    state_code: parsed.state,
    phone_e164: parsed.phoneE164,
    label: parsed.label,
  }, { onConflict: 'state_code' });
  if (error) return { error: 'Could not save that caller ID.' };
  return { ok: true };
}

export async function saveCooldown(input: { cooldownDays: string; watermark: string }): Promise<{ error: string } | { ok: true }> {
  const parsed = parseIdentitySettings(input);
  if ('error' in parsed) return parsed;
  if (!storageConfigured()) return { error: 'Identity storage is not configured.' };
  const admin = createAdminClient();
  const { error } = await admin.from('identity_settings').update({
    sms_cooldown_days: parsed.cooldownDays,
    sms_pool_low_watermark: parsed.watermark,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) return { error: 'Could not save the pool settings.' };
  return { ok: true };
}

export async function markUnmatchedReviewed(id: string): Promise<void> {
  if (!storageConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const admin = createAdminClient();
  await admin.from('unmatched_inbound').update({ reviewed_at: new Date().toISOString() }).eq('id', id);
}

export async function releaseIdentityNumber(dealId: string, dealerId: string): Promise<void> {
  if (!storageConfigured()) return;
  const admin = createAdminClient();
  await endConversationIdentity(admin, { dealId, dealerId });
}

function storageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function publicIdentity(identity: ConversationIdentity): IdentityRow {
  return {
    id: identity.id,
    dealId: identity.dealId,
    dealerId: identity.dealerId,
    shopperFirstName: identity.shopperFirstName,
    emailAlias: identity.emailAlias,
    aliasDomain: identity.aliasDomain,
    smsNumberE164: identity.smsNumberE164,
    voiceNumberE164: identity.voiceNumberE164,
    isTest: identity.isTest,
    endedAt: identity.endedAt,
    createdAt: identity.createdAt,
  };
}

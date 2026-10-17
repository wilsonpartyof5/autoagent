/**
 * Service-role access to conversation identities, the text-number pool,
 * and inbound messages that did not match a conversation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  addressList,
  buildEmailAlias,
  DEFAULT_COOLDOWN_DAYS,
  DEFAULT_LOW_WATERMARK,
  extractMessageIds,
  normalizeEmailAddress,
  pickSmsNumber,
  pickVoiceNumber,
  randomAliasTag,
  readShopperFirstName,
  routeInbound,
  smsPoolHealth,
  threadMessageId,
  type ConversationIdentity,
  type InboundRoute,
  type PoolNumber,
  type SmsAssignment,
} from './identity';
import { normalizePhone, type TelnyxClientState } from './telnyx';

const IDENTITY_COLUMNS = 'id, deal_id, dealer_id, shopper_id, shopper_first_name, email_alias, sms_number_e164, voice_number_e164, locked_at, created_at, is_test, ended_at';

export type IdentityRouter = {
  route(input: {
    channel: 'email' | 'sms' | 'call' | 'voicemail' | null;
    to: string | null;
    from: string | null;
    inReplyTo: string | null;
    references: string | null;
    clientState: TelnyxClientState;
  }): Promise<InboundRoute | null>;
  recordUnmatched(input: {
    channel: 'email' | 'sms' | 'call' | 'voicemail';
    from: string | null;
    to: string | null;
    body: string | null;
    inReplyTo: string | null;
    references: string | null;
    isTest: boolean;
  }): Promise<void>;
  remember(input: {
    conversationId: string;
    channel: 'sms' | 'email';
    ourAddress: string;
    theirAddress: string;
    messageId: string | null;
  }): Promise<void>;
};

export function supabaseIdentityRouter(supabase: SupabaseClient): IdentityRouter {
  return {
    async route(input) {
      try {
        const identities = new Map<string, ReturnType<typeof mapIdentity>>();
        const parties: { conversationId: string; channel: 'sms' | 'email'; ourAddress: string; theirAddress: string }[] = [];
        const threads: { conversationId: string; messageId: string }[] = [];

        const emails = addressList(input.to, 'email');
        if (emails.length > 0) {
          const { data } = await supabase.from('conversation_identities').select(IDENTITY_COLUMNS).in('email_alias', emails);
          for (const row of data ?? []) rememberIdentity(identities, row);
        }

        const smsTo = addressList(input.to, 'sms');
        const smsFrom = addressList(input.from, 'sms');
        if (smsTo.length > 0 && smsFrom.length > 0) {
          const { data: partyRows } = await supabase
            .from('conversation_parties')
            .select('conversation_id, channel, our_address, their_address')
            .eq('channel', 'sms')
            .in('our_address', smsTo)
            .in('their_address', smsFrom);
          const ids: string[] = [];
          for (const row of partyRows ?? []) {
            parties.push({
              conversationId: row.conversation_id,
              channel: 'sms',
              ourAddress: row.our_address,
              theirAddress: row.their_address,
            });
            ids.push(row.conversation_id);
          }
          await loadIdentities(supabase, identities, ids);
        }

        const messageIds = [...extractMessageIds(input.inReplyTo), ...extractMessageIds(input.references)];
        if (messageIds.length > 0) {
          const { data: keys } = await supabase
            .from('conversation_thread_keys')
            .select('message_id, conversation_id')
            .in('message_id', messageIds);
          const ids: string[] = [];
          for (const key of keys ?? []) {
            threads.push({ conversationId: key.conversation_id, messageId: key.message_id });
            ids.push(key.conversation_id);
          }
          await loadIdentities(supabase, identities, ids);
        }

        if (input.clientState.conversationId) {
          await loadIdentities(supabase, identities, [input.clientState.conversationId]);
        } else if (input.clientState.dealId) {
          let query = supabase.from('conversation_identities').select(IDENTITY_COLUMNS).eq('deal_id', input.clientState.dealId);
          if (input.clientState.dealerId) query = query.eq('dealer_id', input.clientState.dealerId);
          const { data } = await query.limit(5);
          for (const row of data ?? []) rememberIdentity(identities, row);
        }

        return routeInbound({
          channel: input.channel,
          to: input.to,
          from: input.from,
          inReplyTo: input.inReplyTo,
          references: input.references,
          clientState: input.clientState,
          identities: [...identities.values()].map(toRouteIdentity),
          parties,
          threads,
        });
      } catch {
        return null;
      }
    },
    async recordUnmatched(input) {
      try {
        await supabase.from('unmatched_inbound').insert({
          channel: input.channel,
          from_address: input.from,
          to_address: input.to,
          body: input.body,
          in_reply_to: input.inReplyTo,
          references_header: input.references,
          is_test: input.isTest,
        });
      } catch {
        // Review can only show rows that stored. A storage failure still leaves the vendor event.
      }
    },
    async remember(input) {
      const ourAddress = input.channel === 'sms' ? normalizePhone(input.ourAddress) : normalizeEmailAddress(input.ourAddress);
      const theirAddress = input.channel === 'sms' ? normalizePhone(input.theirAddress) : normalizeEmailAddress(input.theirAddress);
      if (ourAddress && theirAddress) {
        await supabase.from('conversation_parties').insert({
          conversation_id: input.conversationId,
          channel: input.channel,
          our_address: ourAddress,
          their_address: theirAddress,
        });
      }
      if (input.messageId) {
        await supabase.from('conversation_thread_keys').insert({
          message_id: input.messageId.toLowerCase(),
          conversation_id: input.conversationId,
        });
      }
    },
  };
}

export async function ensureConversationIdentity(
  supabase: SupabaseClient,
  input: {
    dealId: string;
    dealerId: string;
    shopperId: string;
    dealerState?: string | null;
    isTest?: boolean;
    random?: () => number;
  },
): Promise<ConversationIdentity | { error: string }> {
  const existing = await findIdentity(supabase, input.dealId, input.dealerId);
  if (existing) return existing;

  const firstName = await loadShopperFirstName(supabase, input.shopperId);
  if (!firstName) return { error: 'The shopper first name is not on the profile.' };

  const test = input.isTest === true;
  const [settings, pool, assignments, voices] = await Promise.all([
    loadSettings(supabase),
    loadPool(supabase),
    loadAssignments(supabase, input.dealerId),
    loadVoices(supabase),
  ]);
  const voiceNumberE164 = pickVoiceNumber(voices, input.dealerState);
  const random = input.random ?? Math.random;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const picked = pickSmsNumber({
      pool,
      assignments,
      dealerId: input.dealerId,
      shopperId: input.shopperId,
      now: new Date(),
      cooldownDays: settings.cooldownDays,
      test,
    });
    if ('error' in picked) return { error: 'No text number is free for this dealer. Purchase another Telnyx number.' };
    const alias = buildEmailAlias(firstName, randomAliasTag(random));
    if (!alias) return { error: 'Could not build an email alias from the shopper first name.' };

    const { data, error } = await supabase
      .from('conversation_identities')
      .insert({
        deal_id: input.dealId,
        dealer_id: input.dealerId,
        shopper_id: input.shopperId,
        shopper_first_name: firstName,
        email_alias: alias,
        sms_number_e164: picked.phoneE164,
        voice_number_e164: voiceNumberE164,
        is_test: test,
      })
      .select(IDENTITY_COLUMNS)
      .single();

    if (!error && data) {
      const winner = await findIdentity(supabase, input.dealId, input.dealerId);
      return winner ?? mapIdentity(data);
    }
    if (!error) return { error: 'Could not assign a conversation identity.' };

    const raced = await findIdentity(supabase, input.dealId, input.dealerId);
    if (raced) return raced;
    if (/email_alias/i.test(error?.message ?? '')) continue;

    assignments.push({
      dealerId: input.dealerId,
      shopperId: input.shopperId === 'blocked' ? input.shopperId : `other-${attempt}`,
      smsNumberE164: picked.phoneE164,
      endedAt: null,
    });
  }
  return { error: 'Could not assign a conversation identity.' };
}

export async function endConversationIdentity(
  supabase: SupabaseClient,
  input: { dealId: string; dealerId: string },
): Promise<boolean> {
  const { error } = await supabase
    .from('conversation_identities')
    .update({ ended_at: new Date().toISOString() })
    .eq('deal_id', input.dealId)
    .eq('dealer_id', input.dealerId)
    .is('ended_at', null);
  return !error;
}

export async function findIdentity(
  supabase: SupabaseClient,
  dealId: string,
  dealerId: string,
): Promise<ConversationIdentity | null> {
  const { data } = await supabase
    .from('conversation_identities')
    .select(IDENTITY_COLUMNS)
    .eq('deal_id', dealId)
    .eq('dealer_id', dealerId)
    .maybeSingle();
  return data ? mapIdentity(data) : null;
}

export function mapIdentity(row: Record<string, unknown>): ConversationIdentity {
  return {
    id: String(row.id),
    dealId: String(row.deal_id),
    dealerId: String(row.dealer_id),
    shopperId: String(row.shopper_id),
    shopperFirstName: String(row.shopper_first_name),
    emailAlias: String(row.email_alias),
    smsNumberE164: String(row.sms_number_e164),
    voiceNumberE164: row.voice_number_e164 ? String(row.voice_number_e164) : null,
    lockedAt: String(row.locked_at),
    createdAt: String(row.created_at),
    isTest: row.is_test === true,
    endedAt: row.ended_at ? String(row.ended_at) : null,
  };
}

async function loadShopperFirstName(supabase: SupabaseClient, shopperId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('consumer_profiles')
    .select('first_name')
    .eq('user_id', shopperId)
    .maybeSingle();
  let metadata: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase.auth.admin.getUserById(shopperId);
    const raw = data.user?.user_metadata;
    if (raw && typeof raw === 'object') metadata = raw as Record<string, unknown>;
  } catch {
    metadata = null;
  }
  const name = readShopperFirstName(typeof profile?.first_name === 'string' ? profile.first_name : null, metadata);
  if (name && profile && !profile.first_name) {
    await supabase.from('consumer_profiles').update({ first_name: name }).eq('user_id', shopperId).is('first_name', null);
  }
  return name;
}

async function loadSettings(supabase: SupabaseClient): Promise<{ cooldownDays: number; watermark: number }> {
  const { data } = await supabase
    .from('identity_settings')
    .select('sms_cooldown_days, sms_pool_low_watermark')
    .eq('id', 1)
    .maybeSingle();
  return {
    cooldownDays: typeof data?.sms_cooldown_days === 'number' ? data.sms_cooldown_days : DEFAULT_COOLDOWN_DAYS,
    watermark: typeof data?.sms_pool_low_watermark === 'number' ? data.sms_pool_low_watermark : DEFAULT_LOW_WATERMARK,
  };
}

async function loadPool(supabase: SupabaseClient): Promise<PoolNumber[]> {
  const { data } = await supabase.from('sms_number_pool').select('phone_e164, status, is_test, last_assigned_at');
  return (data ?? []).map((row) => ({
    phoneE164: row.phone_e164,
    status: row.status === 'retired' ? 'retired' : 'active',
    isTest: row.is_test === true,
    lastAssignedAt: row.last_assigned_at ?? null,
  }));
}

async function loadAssignments(supabase: SupabaseClient, dealerId: string): Promise<SmsAssignment[]> {
  const { data } = await supabase
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

async function loadVoices(supabase: SupabaseClient): Promise<{ state: string; phoneE164: string }[]> {
  const { data } = await supabase.from('voice_numbers').select('state_code, phone_e164');
  return (data ?? []).map((row) => ({ state: row.state_code, phoneE164: row.phone_e164 }));
}

async function loadIdentities(
  supabase: SupabaseClient,
  into: Map<string, ConversationIdentity>,
  ids: string[],
): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => id && !into.has(id));
  if (missing.length === 0) return;
  const { data } = await supabase.from('conversation_identities').select(IDENTITY_COLUMNS).in('id', missing);
  for (const row of data ?? []) rememberIdentity(into, row);
}

function rememberIdentity(into: Map<string, ConversationIdentity>, row: Record<string, unknown>): void {
  const identity = mapIdentity(row);
  into.set(identity.id, identity);
}

function toRouteIdentity(identity: ConversationIdentity) {
  return {
    id: identity.id,
    dealId: identity.dealId,
    dealerId: identity.dealerId,
    emailAlias: identity.emailAlias,
    smsNumberE164: identity.smsNumberE164,
    endedAt: identity.endedAt,
  };
}

export function outboundThreadId(conversationId: string, vendorEventId: string): string {
  return threadMessageId(conversationId, vendorEventId);
}

export { smsPoolHealth };

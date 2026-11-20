/**
 * Shopper side of an in-network dealer thread.
 * Reads and writes shopper_dealer_messages for the signed-in shopper.
 * The payload is first name, opener, and message text. No phone, email,
 * street address, or last name column is selected or returned.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { shopperFirstNameOnly } from '@/lib/dealer/rooftop-match';
import { ShopperDealError } from './deals';

const MESSAGE_LIMIT = 2000;

export type ShopperThreadMessage = {
  id: string;
  author: 'drevvy' | 'shopper' | 'salesperson';
  kind: 'chat' | 'opener' | 'numbers';
  body: string;
  sentAt: string;
};

export type ShopperThread = {
  id: string;
  shopperFirstName: string | null;
  opener: string;
  channel: 'in_app_message';
  messages: ShopperThreadMessage[];
};

type ConversationRow = {
  deal_id: string;
  consumer_user_id: string;
  shopper_first_name: string | null;
  opener: string | null;
  channel: string | null;
};

function present(row: ConversationRow, messages: ShopperThreadMessage[]): ShopperThread {
  const first = shopperFirstNameOnly(row.shopper_first_name);
  return {
    id: row.deal_id,
    shopperFirstName: first,
    opener: row.opener?.trim() || `${first ?? 'A shopper'} wants your best itemized out-the-door`,
    channel: 'in_app_message',
    messages,
  };
}

async function ownedConversation(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<ConversationRow> {
  const loaded = await supabase
    .from('shopper_dealer_conversations')
    .select('deal_id, consumer_user_id, shopper_first_name, opener, channel')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (loaded.error) {
    throw new ShopperDealError('Drevvy could not load this conversation.', 500, 'thread_failed');
  }
  const row = loaded.data as ConversationRow | null;
  if (!row || row.consumer_user_id !== userId) {
    throw new ShopperDealError('That conversation is not in your list.', 404, 'not_found');
  }
  if (row.channel !== 'in_app_message') {
    throw new ShopperDealError('This conversation is message-only inside Drevvy.', 409, 'not_chat');
  }
  return row;
}

async function loadMessages(supabase: SupabaseClient, dealId: string): Promise<ShopperThreadMessage[]> {
  const loaded = await supabase
    .from('shopper_dealer_messages')
    .select('id, author, kind, body, sent_at')
    .eq('deal_id', dealId);
  if (loaded.error) {
    throw new ShopperDealError('Drevvy could not load this conversation.', 500, 'thread_failed');
  }
  const rows = (loaded.data ?? []) as Array<{
    id: string;
    author: string;
    kind: string;
    body: string;
    sent_at: string;
  }>;
  return rows
    .filter((row) => row.author === 'drevvy' || row.author === 'shopper' || row.author === 'salesperson')
    .filter((row) => row.kind === 'chat' || row.kind === 'opener' || row.kind === 'numbers')
    .map((row) => ({
      id: row.id,
      author: row.author as ShopperThreadMessage['author'],
      kind: row.kind as ShopperThreadMessage['kind'],
      body: row.body,
      sentAt: row.sent_at,
    }))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
}

export async function readShopperThread(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<ShopperThread> {
  const row = await ownedConversation(supabase, userId, dealId);
  const messages = await loadMessages(supabase, dealId);
  if (messages.length === 0 && row.opener) {
    messages.push({
      id: 'opener',
      author: 'drevvy',
      kind: 'opener',
      body: row.opener,
      sentAt: new Date(0).toISOString(),
    });
  }
  return present(row, messages);
}

export async function postShopperThreadMessage(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  body: string,
  now = new Date(),
): Promise<ShopperThread> {
  const text = body.trim();
  if (!text) throw new ShopperDealError('Write a message first.', 400, 'empty_message');
  if (text.length > MESSAGE_LIMIT) throw new ShopperDealError('That message is too long.', 400, 'message_too_long');
  const row = await ownedConversation(supabase, userId, dealId);
  const saved = await supabase.from('shopper_dealer_messages').insert({
    deal_id: dealId,
    author: 'shopper',
    kind: 'chat',
    body: text,
    sent_at: now.toISOString(),
  });
  if (saved.error) {
    throw new ShopperDealError('Drevvy could not send that message.', 500, 'thread_failed');
  }
  const messages = await loadMessages(supabase, dealId);
  return present(row, messages);
}

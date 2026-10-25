'use server';

import { revalidatePath } from 'next/cache';

import {
  allInboxItems,
  markSold,
  postMessage,
  shareNumbers,
} from '@/lib/dealer/mock';
import type {
  ConversationDetail,
  DealerDemoError,
  InboxItem,
} from '@/lib/dealer/types';

export type DeskMutation =
  | { ok: true; conversation: ConversationDetail; items: InboxItem[] }
  | { ok: false; error: DealerDemoError };

function publish(
  leadId: string,
  conversation: ConversationDetail
): DeskMutation {
  revalidatePath('/dealer/inbox');
  revalidatePath(`/dealer/leads/${leadId}`);
  revalidatePath('/dealer/analytics');
  revalidatePath('/dealer/settings');
  return { ok: true, conversation, items: allInboxItems() };
}

export async function markConversationSold(
  leadId: string
): Promise<DeskMutation> {
  const result = markSold(leadId);
  if (!result.ok) return result;
  return publish(leadId, result.data);
}

export async function postConversationMessage(
  leadId: string,
  body: string
): Promise<DeskMutation> {
  const result = postMessage(leadId, body);
  if (!result.ok) return result;
  return publish(leadId, result.data);
}

export async function shareConversationNumbers(
  leadId: string,
  input: {
    statedPriceCents: number;
    writtenOtdCents: number | null;
    note: string;
  }
): Promise<DeskMutation> {
  const result = shareNumbers(leadId, input);
  if (!result.ok) return result;
  return publish(leadId, result.data);
}

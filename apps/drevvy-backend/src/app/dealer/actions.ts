'use server';

import { revalidatePath } from 'next/cache';

import { gateLiveDealerSession } from '@/lib/dealer/activation-gate';
import {
  deskWriteTarget,
  isolatedInboxItems,
  postIsolatedDealerMessage,
  shareIsolatedItemized,
  threadFixtureEnabled,
} from '@/lib/dealer/isolated-thread';
import {
  listLiveInbox,
  markLiveSold,
  postLiveMessage,
  shareLiveNumbers,
} from '@/lib/dealer/live-store';
import {
  allInboxItems,
  markSold,
  postMessage,
  shareNumbers,
} from '@/lib/dealer/mock';
import { isLiveDealerSession, requireDealerPageSession } from '@/lib/dealer/session';
import type { ItemizedOtdLines } from '@/lib/dealer/format';
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
  conversation: ConversationDetail,
  items: InboxItem[],
): DeskMutation {
  revalidatePath('/dealer/inbox');
  revalidatePath(`/dealer/leads/${leadId}`);
  revalidatePath('/dealer/analytics');
  revalidatePath('/dealer/settings');
  revalidatePath('/dealer/billing');
  return { ok: true, conversation, items };
}

async function liveWriteAllowed(session: NonNullable<Awaited<ReturnType<typeof requireDealerPageSession>>>): Promise<boolean> {
  return (await gateLiveDealerSession(session)).ok;
}

async function liveItems(leadId: string, conversation: ConversationDetail): Promise<DeskMutation> {
  const session = await requireDealerPageSession();
  if (!isLiveDealerSession(session)) return publish(leadId, conversation, allInboxItems());
  const items = await listLiveInbox(session, 'all', null);
  return publish(leadId, conversation, items ?? []);
}

export async function markConversationSold(
  leadId: string,
): Promise<DeskMutation> {
  const session = await requireDealerPageSession();
  const fixtureOn = threadFixtureEnabled();
  if (isLiveDealerSession(session) && deskWriteTarget(true, leadId, fixtureOn) === 'live') {
    if (!await liveWriteAllowed(session)) return { ok: false, error: 'not_found' };
    const result = await markLiveSold(session, leadId);
    if (!result.ok) return result;
    return liveItems(leadId, result.data);
  }
  const result = markSold(leadId);
  if (!result.ok) return result;
  return publish(leadId, result.data, allInboxItems());
}

export async function postConversationMessage(
  leadId: string,
  body: string,
): Promise<DeskMutation> {
  const session = await requireDealerPageSession();
  const target = deskWriteTarget(isLiveDealerSession(session), leadId, threadFixtureEnabled());
  if (target === 'fixture') {
    const result = postIsolatedDealerMessage(leadId, body);
    if (!result.ok) return result;
    return publish(leadId, result.data, [...isolatedInboxItems('all'), ...allInboxItems()]);
  }
  if (target === 'live' && isLiveDealerSession(session)) {
    if (!await liveWriteAllowed(session)) return { ok: false, error: 'not_found' };
    const result = await postLiveMessage(session, leadId, body);
    if (!result.ok) return result;
    return liveItems(leadId, result.data);
  }
  const result = postMessage(leadId, body);
  if (!result.ok) return result;
  return publish(leadId, result.data, allInboxItems());
}

export async function shareConversationNumbers(
  leadId: string,
  input: {
    statedPriceCents: number;
    writtenOtdCents: number | null;
    note: string;
    lines?: ItemizedOtdLines | null;
  },
): Promise<DeskMutation> {
  const session = await requireDealerPageSession();
  const target = deskWriteTarget(isLiveDealerSession(session), leadId, threadFixtureEnabled());
  if (target === 'fixture') {
    if (!input.lines) return { ok: false, error: 'invalid_price' };
    const result = shareIsolatedItemized(leadId, input.lines, input.note, new Date(), input.writtenOtdCents);
    if (!result.ok) return result;
    return publish(leadId, result.data, [...isolatedInboxItems('all'), ...allInboxItems()]);
  }
  if (target === 'live' && isLiveDealerSession(session)) {
    if (!await liveWriteAllowed(session)) return { ok: false, error: 'not_found' };
    const result = await shareLiveNumbers(session, leadId, input);
    if (!result.ok) return result;
    return liveItems(leadId, result.data);
  }
  const result = shareNumbers(leadId, input);
  if (!result.ok) return result;
  return publish(leadId, result.data, allInboxItems());
}

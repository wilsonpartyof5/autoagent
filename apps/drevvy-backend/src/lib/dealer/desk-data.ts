import { gateLiveDealerSession } from './activation-gate';
import { CLOSE_FEE_CENTS, CLOSE_FEE_COPY, isOpenStage, RANGE_LABEL } from './format';
import {
  isolatedConversation,
  isolatedInboxItems,
  isIsolatedThreadId,
  threadFixtureEnabled,
} from './isolated-thread';
import {
  listLiveInbox,
  liveAnalytics,
  liveBilling,
  presentLiveConversation,
} from './live-store';
import {
  allInboxItems,
  analyticsSummary,
  billingSnapshot,
  presentConversation,
} from './mock';
import { isLiveDealerSession, type DealerSession } from './session';
import type {
  AnalyticsRange,
  AnalyticsSummary,
  BillingSnapshot,
  ConversationDetail,
  InboxItem,
} from './types';

export type DeskInboxPayload = {
  source: 'live' | 'mock';
  items: InboxItem[];
  preview: ConversationDetail | null;
};

async function liveActivated(session: DealerSession): Promise<boolean> {
  return (await gateLiveDealerSession(session)).ok;
}

export async function loadDeskInbox(session: DealerSession | null): Promise<DeskInboxPayload> {
  if (isLiveDealerSession(session)) {
    if (!await liveActivated(session)) return { source: 'live', items: [], preview: null };
    const items = await listLiveInbox(session, 'all', null);
    if (items) {
      const previewId = items.find((item) => item.stage === 'numbers_shared')?.id
        ?? items.find((item) => isOpenStage(item.stage))?.id
        ?? items[0]?.id
        ?? null;
      const preview = previewId ? await presentLiveConversation(session, previewId) : null;
      return { source: 'live', items, preview };
    }
  }
  const fixtures = threadFixtureEnabled() ? isolatedInboxItems('all') : [];
  return {
    source: 'mock',
    items: [...fixtures, ...allInboxItems()],
    preview: fixtures[0] ? isolatedConversation(fixtures[0].id) : presentConversation('conv_tucson'),
  };
}

export async function loadDeskConversation(
  session: DealerSession | null,
  leadId: string,
): Promise<{ source: 'live' | 'mock'; items: InboxItem[]; conversation: ConversationDetail | null }> {
  if (isLiveDealerSession(session)) {
    if (!await liveActivated(session)) return { source: 'live', items: [], conversation: null };
    const [conversation, items] = await Promise.all([
      presentLiveConversation(session, leadId),
      listLiveInbox(session, 'all', null),
    ]);
    return { source: 'live', items: items ?? [], conversation };
  }
  if (threadFixtureEnabled() && isIsolatedThreadId(leadId)) {
    return {
      source: 'mock',
      items: [...isolatedInboxItems('all'), ...allInboxItems()],
      conversation: isolatedConversation(leadId),
    };
  }
  return {
    source: 'mock',
    items: allInboxItems(),
    conversation: presentConversation(leadId),
  };
}

export async function loadDeskAnalytics(session: DealerSession | null): Promise<AnalyticsSummary[]> {
  const ranges: AnalyticsRange[] = ['7d', '30d', '90d'];
  if (isLiveDealerSession(session)) {
    if (!await liveActivated(session)) {
      return ranges.map((range) => ({
        source: 'live' as const,
        range,
        rangeLabel: RANGE_LABEL[range],
        replyRate: 0,
        medianFirstReplyMinutes: 0,
        conversationsStarted: 0,
        conversationsClosed: 0,
        numbersShared: 0,
      }));
    }
    const summaries = await Promise.all(ranges.map((range) => liveAnalytics(session, range, null)));
    if (summaries.every((summary) => summary != null)) return summaries as AnalyticsSummary[];
  }
  return ranges.map((range) => analyticsSummary(range));
}

export async function loadDeskBilling(session: DealerSession | null): Promise<BillingSnapshot> {
  if (isLiveDealerSession(session)) {
    if (!await liveActivated(session)) {
      return {
        source: 'live',
        role: session.role,
        dayToDay: 'free',
        closeFeeCents: CLOSE_FEE_CENTS,
        closeFeeLabel: CLOSE_FEE_COPY,
        paymentMethod: { brand: 'Visa', last4: '4242', placeholder: true },
        charges: [],
      };
    }
    const live = await liveBilling(session);
    if (live) return live;
  }
  return billingSnapshot();
}

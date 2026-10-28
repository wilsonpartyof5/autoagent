import { isOpenStage } from './format';
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
import type { DealerSession } from './session';
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

export async function loadDeskInbox(session: DealerSession | null): Promise<DeskInboxPayload> {
  if (session) {
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
  return {
    source: 'mock',
    items: allInboxItems(),
    preview: presentConversation('conv_tucson'),
  };
}

export async function loadDeskConversation(
  session: DealerSession | null,
  leadId: string,
): Promise<{ source: 'live' | 'mock'; items: InboxItem[]; conversation: ConversationDetail | null }> {
  if (session) {
    const [conversation, items] = await Promise.all([
      presentLiveConversation(session, leadId),
      listLiveInbox(session, 'all', null),
    ]);
    return { source: 'live', items: items ?? [], conversation };
  }
  return {
    source: 'mock',
    items: allInboxItems(),
    conversation: presentConversation(leadId),
  };
}

export async function loadDeskAnalytics(session: DealerSession | null): Promise<AnalyticsSummary[]> {
  const ranges: AnalyticsRange[] = ['7d', '30d', '90d'];
  if (session) {
    const summaries = await Promise.all(ranges.map((range) => liveAnalytics(session, range, null)));
    if (summaries.every((summary) => summary != null)) return summaries as AnalyticsSummary[];
  }
  return ranges.map((range) => analyticsSummary(range));
}

export async function loadDeskBilling(session: DealerSession | null): Promise<BillingSnapshot> {
  if (session) {
    const live = await liveBilling(session);
    if (live) return live;
  }
  return billingSnapshot();
}

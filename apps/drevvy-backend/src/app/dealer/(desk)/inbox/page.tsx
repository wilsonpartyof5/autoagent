import type { Metadata } from 'next';

import { InboxDesk } from '@/components/dealer/inbox-desk';
import { loadDeskInbox } from '@/lib/dealer/desk-data';
import { requireDealerPageSession } from '@/lib/dealer/session';

export const metadata: Metadata = { title: 'Inbox' };

export default async function DealerInboxPage() {
  const session = await requireDealerPageSession();
  const desk = await loadDeskInbox(session);
  return (
    <InboxDesk
      initialItems={desk.items}
      initialConversation={null}
      previewConversation={desk.preview}
      selectedId={null}
    />
  );
}

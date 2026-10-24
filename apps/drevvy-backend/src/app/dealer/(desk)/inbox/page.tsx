import type { Metadata } from 'next';

import { InboxDesk } from '@/components/dealer/inbox-desk';
import { allInboxItems } from '@/lib/dealer/mock';

export const metadata: Metadata = { title: 'Inbox' };

export default function DealerInboxPage() {
  return (
    <InboxDesk
      initialItems={allInboxItems()}
      initialConversation={null}
      selectedId={null}
    />
  );
}

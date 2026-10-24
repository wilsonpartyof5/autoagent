import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InboxDesk } from '@/components/dealer/inbox-desk';
import { allInboxItems, presentConversation } from '@/lib/dealer/mock';

export const metadata: Metadata = { title: 'Conversation' };

export default async function DealerConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = presentConversation(id);
  if (!conversation) notFound();
  return (
    <InboxDesk
      initialItems={allInboxItems()}
      initialConversation={conversation}
      selectedId={id}
    />
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InboxDesk } from '@/components/dealer/inbox-desk';
import { loadDeskConversation } from '@/lib/dealer/desk-data';
import { requireDealerPageSession } from '@/lib/dealer/session';

export const metadata: Metadata = { title: 'Conversation' };

export default async function DealerConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireDealerPageSession();
  const desk = await loadDeskConversation(session, id);
  if (!desk.conversation) notFound();
  return (
    <InboxDesk
      initialItems={desk.items}
      initialConversation={desk.conversation}
      selectedId={id}
    />
  );
}

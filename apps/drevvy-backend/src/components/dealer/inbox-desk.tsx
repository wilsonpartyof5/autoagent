'use client';

import Link from 'next/link';
import { useState } from 'react';

import { matchesInboxFilter } from '@/lib/dealer/format';
import type {
  ConversationDetail,
  InboxFilter,
  InboxItem,
} from '@/lib/dealer/types';
import { ConversationPane } from './conversation-pane';
import { filterLabel, PriceLine, SlaText, StageChip } from './stage-chip';

const FILTERS: InboxFilter[] = ['needs_reply', 'all_open', 'closed'];

export function InboxDesk({
  initialItems,
  initialConversation,
  selectedId,
}: {
  initialItems: InboxItem[];
  initialConversation: ConversationDetail | null;
  selectedId: string | null;
}) {
  const selection = selectedId ?? '';
  const [shownId, setShownId] = useState(selection);
  const [items, setItems] = useState(initialItems);
  const [conversation, setConversation] = useState(initialConversation);
  const [filter, setFilter] = useState<InboxFilter>(
    initialFilter(initialConversation)
  );

  if (shownId !== selection) {
    setShownId(selection);
    setItems(initialItems);
    setConversation(initialConversation);
    setFilter(initialFilter(initialConversation));
  }

  const visible = items.filter(item => matchesInboxFilter(item, filter));
  const showList = selectedId == null;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section
        className={`${showList ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col border-r border-border bg-card`}
      >
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-lg font-extrabold">Inbox</h1>
          <p className="text-xs leading-5 text-muted-foreground">
            Buyer via Drevvy. First name only when the shopper shared one.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map(value => {
              const count = items.filter(item =>
                matchesInboxFilter(item, value)
              ).length;
              const selected = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    selected
                      ? 'bg-[#171A2C] text-white'
                      : 'border border-border bg-background text-foreground'
                  }`}
                >
                  {filterLabel(value)} {count}
                </button>
              );
            })}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-4 py-8 text-sm text-muted-foreground">
              Nothing in this filter.
            </li>
          ) : (
            visible.map(item => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <Link
                    href={`/dealer/leads/${item.id}`}
                    aria-current={selected ? 'page' : undefined}
                    className={`block border-b border-border px-4 py-3 ${
                      selected ? 'bg-background' : 'hover:bg-background'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {item.buyerLabel}
                      </p>
                      <SlaText sla={item.sla} />
                    </div>
                    <p className="mt-1 font-extrabold">
                      {item.shopperDisplayName}
                    </p>
                    <p className="text-sm">{item.vehicleTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock #{item.stockNumber}
                    </p>
                    <div className="mt-1">
                      <PriceLine
                        advertisedPriceCents={item.advertisedPriceCents}
                        statedPriceCents={item.statedPriceCents}
                        priceDiffers={item.priceDiffers}
                      />
                    </div>
                    <div className="mt-2">
                      <StageChip stage={item.stage} label={item.stageLabel} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {item.snippet}
                    </p>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>
      <section
        className={`${showList ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col`}
      >
        {conversation ? (
          <ConversationPane
            key={conversation.id}
            conversation={conversation}
            onUpdated={(next, nextItems) => {
              setConversation(next);
              setItems(nextItems);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            Select a conversation.
          </div>
        )}
      </section>
    </div>
  );
}

function initialFilter(conversation: ConversationDetail | null): InboxFilter {
  if (!conversation) return 'needs_reply';
  if (conversation.needsReply) return 'needs_reply';
  if (
    conversation.stage === 'new_request' ||
    conversation.stage === 'in_conversation' ||
    conversation.stage === 'numbers_shared'
  ) {
    return 'all_open';
  }
  return 'closed';
}

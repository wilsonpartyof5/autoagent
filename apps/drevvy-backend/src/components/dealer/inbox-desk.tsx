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
  previewConversation = null,
  selectedId,
}: {
  initialItems: InboxItem[];
  initialConversation: ConversationDetail | null;
  /** Desktop split fills the detail pane with this thread until a row is opened. */
  previewConversation?: ConversationDetail | null;
  selectedId: string | null;
}) {
  const selection = selectedId ?? '';
  const [shownId, setShownId] = useState(selection);
  const [items, setItems] = useState(initialItems);
  const [conversation, setConversation] = useState(initialConversation);
  const [filter, setFilter] = useState<InboxFilter>(
    initialFilter(initialConversation ?? previewConversation)
  );

  if (shownId !== selection) {
    setShownId(selection);
    setItems(initialItems);
    setConversation(initialConversation);
    setFilter(initialFilter(initialConversation ?? previewConversation));
  }

  const visible = items.filter(item => matchesInboxFilter(item, filter));
  const showList = selectedId == null;
  const detail = conversation ?? previewConversation;
  const previewId = selectedId == null ? (previewConversation?.id ?? null) : null;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
      <section
        className={`${showList ? 'flex' : 'hidden md:flex'} min-h-0 flex-col border-r border-border bg-card`}
      >
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-lg font-extrabold">Inbox</h1>
          <p className="text-xs leading-5 text-muted-foreground">
            Buyer via Drevvy, plus a short reference. No name or city.
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
              const selected = item.id === selectedId || item.id === previewId;
              return (
                <li key={item.id}>
                  <Link
                    href={`/dealer/leads/${item.id}`}
                    aria-current={item.id === selectedId ? 'page' : undefined}
                    className={`block border-b border-border px-4 py-3 ${
                      selected
                        ? 'bg-background max-md:bg-transparent'
                        : 'hover:bg-background'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-extrabold">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {item.buyerLabel}
                        </span>{' '}
                        {item.shopperRef}
                      </p>
                      <SlaText sla={item.sla} />
                    </div>
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
        className={`${showList ? 'hidden md:flex' : 'flex'} min-h-0 flex-col`}
      >
        {detail ? (
          <ConversationPane
            key={detail.id}
            conversation={detail}
            onUpdated={(next, nextItems) => {
              setConversation(next);
              setItems(nextItems);
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-extrabold">Select a conversation</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              The thread and composer open in this pane.
            </p>
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

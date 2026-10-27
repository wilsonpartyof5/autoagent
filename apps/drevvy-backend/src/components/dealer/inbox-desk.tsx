'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useGlassTheme } from '@/components/glass/glass-theme';
import { shopperDeskLabel } from '@/lib/dealer/demo-org';
import { matchesInboxFilter } from '@/lib/dealer/format';
import type {
  ConversationDetail,
  InboxFilter,
  InboxItem,
} from '@/lib/dealer/types';
import { ConversationPane } from './conversation-pane';
import { filterLabel, PriceLine, SlaText, StageChip } from './stage-chip';

const FILTERS: InboxFilter[] = ['needs_reply', 'in_chat', 'all'];

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
  const { rooftopId } = useGlassTheme();
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

  const rooftopItems =
    rooftopId === 'all'
      ? items
      : items.filter(item => item.rooftopId === rooftopId);
  const visible = rooftopItems.filter(item => matchesInboxFilter(item, filter));
  const showList = selectedId == null;
  const detail = conversation ?? previewConversation;
  const previewId = selectedId == null ? (previewConversation?.id ?? null) : null;

  return (
    <div className="row desk-split">
      <section
        className={`g card ${showList ? 'flex' : 'hidden md:flex'} min-h-0 flex-col gap-1.5`}
      >
        <div className="pills" style={{ marginBottom: 8 }}>
          {FILTERS.map(value => {
            const count = rooftopItems.filter(item =>
              matchesInboxFilter(item, value)
            ).length;
            const selected = filter === value;
            return (
              <button
                key={value}
                type="button"
                className={`pill${selected ? ' on' : ''}`}
                aria-pressed={selected}
                onClick={() => setFilter(value)}
              >
                {filterLabel(value)} {count}
              </button>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <p className="mut" style={{ padding: 16 }}>
            Nothing in this filter.
          </p>
        ) : (
          visible.map(item => {
            const selected = item.id === selectedId || item.id === previewId;
            return (
              <Link
                key={item.id}
                href={`/dealer/leads/${item.id}`}
                aria-current={item.id === selectedId ? 'page' : undefined}
                className={`lead${selected ? ' on' : ''}`}
              >
                <div className="av">{item.shopperFirstName.slice(0, 1)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{shopperDeskLabel(item.shopperFirstName, item.shopperRef)}</b>
                    <SlaText sla={item.sla} />
                  </div>
                  <div className="mut">{item.vehicleTitle}</div>
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.snippet}
                  </div>
                  <PriceLine
                    advertisedPriceCents={item.advertisedPriceCents}
                    statedPriceCents={item.statedPriceCents}
                    priceDiffers={item.priceDiffers}
                  />
                </div>
                <StageChip stage={item.stage} label={item.stageLabel} />
              </Link>
            );
          })
        )}
      </section>
      <section
        className={`g card ${showList ? 'hidden md:flex' : 'flex'} min-h-0 flex-col gap-3`}
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
            <p className="t">Select a conversation</p>
            <p className="mut">The thread and composer open in this pane.</p>
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
    return 'in_chat';
  }
  return 'all';
}

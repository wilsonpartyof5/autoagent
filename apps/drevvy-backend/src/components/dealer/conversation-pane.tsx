'use client';

import { useState } from 'react';
import Link from 'next/link';

import {
  markConversationSold,
  postConversationMessage,
  shareConversationNumbers,
} from '@/app/dealer/actions';
import {
  dollarsToCents,
  formatMoney,
  formatStamp,
  isOpenStage,
  MARK_SOLD_CONFIRM,
  SHARE_NUMBERS_DISCLAIMER,
} from '@/lib/dealer/format';
import type {
  ConversationDetail,
  DealerDemoError,
  InboxItem,
} from '@/lib/dealer/types';
import { PriceLine, SlaText, StageChip, StageStepper } from './stage-chip';

const HALO = 'bg-[linear-gradient(135deg,#5145DB_0%,#3563E0_100%)]';

const ERROR_COPY: Record<DealerDemoError, string> = {
  not_found: 'That conversation is not in the demo.',
  empty_message: 'Write a message first.',
  message_too_long: 'That message is too long for this demo.',
  invalid_price: 'Enter a price in dollars, at least $1.',
  conversation_closed: 'Closed conversations stay closed in this demo.',
};

export function ConversationPane({
  conversation,
  onUpdated,
}: {
  conversation: ConversationDetail;
  onUpdated: (conversation: ConversationDetail, items: InboxItem[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [stated, setStated] = useState('');
  const [otd, setOtd] = useState('');
  const [note, setNote] = useState('');
  const [showNumbers, setShowNumbers] = useState(false);
  const [confirmSold, setConfirmSold] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const open = isOpenStage(conversation.stage);

  async function sendMessage() {
    setPending(true);
    const result = await postConversationMessage(conversation.id, draft);
    setPending(false);
    if (!result.ok) {
      setError(ERROR_COPY[result.error]);
      return;
    }
    setDraft('');
    setError(null);
    onUpdated(result.conversation, result.items);
  }

  async function share() {
    const statedPriceCents = dollarsToCents(stated);
    if (statedPriceCents == null) {
      setError(ERROR_COPY.invalid_price);
      return;
    }
    const written = otd.trim().length === 0 ? null : dollarsToCents(otd);
    if (otd.trim().length > 0 && written == null) {
      setError(ERROR_COPY.invalid_price);
      return;
    }
    setPending(true);
    const result = await shareConversationNumbers(conversation.id, {
      statedPriceCents,
      writtenOtdCents: written,
      note,
    });
    setPending(false);
    if (!result.ok) {
      setError(ERROR_COPY[result.error]);
      return;
    }
    setStated('');
    setOtd('');
    setNote('');
    setShowNumbers(false);
    setError(null);
    onUpdated(result.conversation, result.items);
  }

  async function confirmMarkSold() {
    setPending(true);
    const result = await markConversationSold(conversation.id);
    setPending(false);
    if (!result.ok) {
      setError(ERROR_COPY[result.error]);
      return;
    }
    setConfirmSold(false);
    setError(null);
    onUpdated(result.conversation, result.items);
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href="/dealer/inbox"
              className="text-xs font-semibold text-[#3C30C4] md:hidden"
            >
              Inbox
            </Link>
            <h1 className="text-lg font-extrabold">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {conversation.buyerLabel}
              </span>{' '}
              {conversation.shopperRef}
            </h1>
            <p className="text-sm text-muted-foreground">Conversation</p>
          </div>
          <div className="text-right">
            <StageChip
              stage={conversation.stage}
              label={conversation.stageLabel}
            />
            <div className="mt-1">
              <SlaText sla={conversation.sla} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm font-semibold">
          {conversation.vehicleTitle}
        </p>
        <p className="text-xs text-muted-foreground">
          Stock #{conversation.stockNumber}
        </p>
        <div className="mt-1">
          <PriceLine
            advertisedPriceCents={conversation.advertisedPriceCents}
            statedPriceCents={conversation.statedPriceCents}
            priceDiffers={conversation.priceDiffers}
          />
        </div>
        <div className="mt-2">
          <StageStepper stage={conversation.stage} />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Templated Get Best Price opener, then freeform chat. Drevvy relays
          both ways. One-click chips are shopper helpers on a later shopper
          screen. This desk does not text, email, or call.
        </p>
      </header>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.map(message => {
          if (message.kind === 'numbers') {
            return (
              <li key={message.id} className="flex justify-start">
                <div className="w-full max-w-[85%] overflow-hidden rounded-xl border border-border bg-card text-sm leading-5">
                  <div className={`h-1 ${HALO}`} />
                  <div className="px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Share numbers · Informational card
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {SHARE_NUMBERS_DISCLAIMER}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatStamp(message.sentAt)}
                  </p>
                  </div>
                </div>
              </li>
            );
          }
          const mine = message.author === 'salesperson';
          const opener = message.kind === 'opener';
          const label = mine
            ? 'You'
            : opener
              ? 'Drevvy'
              : conversation.shopperRef;
          return (
            <li
              key={message.id}
              className={mine ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                  mine
                    ? `${HALO} text-white`
                    : opener
                      ? 'border border-[#ECEAFF] bg-[#F7F8FC] text-foreground'
                      : 'border border-border bg-card text-foreground'
                }`}
              >
                <p
                  className={`text-[11px] font-semibold ${mine ? 'text-white/70' : 'text-muted-foreground'}`}
                >
                  {label}
                  {opener ? ' · Templated opener' : ''}
                </p>
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p
                  className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-muted-foreground'}`}
                >
                  {formatStamp(message.sentAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Reply in this chat
        </p>
        {confirmSold && open ? (
          <div className="mb-3 rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-extrabold">Mark as sold</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {MARK_SOLD_CONFIRM}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmMarkSold}
                disabled={pending}
                className={`rounded-xl px-3 py-2 text-sm font-extrabold text-white disabled:opacity-40 ${HALO}`}
              >
                Mark sold
              </button>
              <button
                type="button"
                onClick={() => setConfirmSold(false)}
                className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {showNumbers && open ? (
          <div className="mb-3 overflow-hidden rounded-xl border border-border bg-background">
            <div className={`h-1 ${HALO}`} />
            <div className="p-3">
            <p className="text-sm font-extrabold">Share numbers</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {SHARE_NUMBERS_DISCLAIMER} Where a written total becomes the
              record is still an open question.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Advertised {formatMoney(conversation.advertisedPriceCents)}
            </p>
            <label
              className="mt-2 block text-xs font-semibold"
              htmlFor="stated-price"
            >
              Price you state
            </label>
            <input
              id="stated-price"
              value={stated}
              onChange={event => setStated(event.target.value)}
              inputMode="decimal"
              placeholder="35400"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <label
              className="mt-2 block text-xs font-semibold"
              htmlFor="otd-price"
            >
              Written out-the-door total (optional)
            </label>
            <input
              id="otd-price"
              value={otd}
              onChange={event => setOtd(event.target.value)}
              inputMode="decimal"
              placeholder="38950"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <label
              className="mt-2 block text-xs font-semibold"
              htmlFor="numbers-note"
            >
              Note (optional)
            </label>
            <textarea
              id="numbers-note"
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={share}
              disabled={pending}
              className="mt-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Share in chat
            </button>
            </div>
          </div>
        ) : null}

        <div className="mb-2 flex flex-wrap gap-2">
          {conversation.replyTemplates.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => setDraft(template.text)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold"
            >
              {template.label}
            </button>
          ))}
          <button
            type="button"
            disabled={!open}
            onClick={() => setShowNumbers(value => !value)}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
          >
            Share numbers
          </button>
          <button
            type="button"
            disabled={!open}
            onClick={() => {
              setShowNumbers(false);
              setConfirmSold(value => !value);
            }}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
          >
            Mark as sold
          </button>
        </div>
        {!open ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Closed conversations stay closed in this demo. You can still reply
            in the thread.
          </p>
        ) : null}
        {error ? (
          <p className="mb-2 text-xs font-semibold text-[#B42828]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-composer">
            Reply in this chat
          </label>
          <textarea
            id="chat-composer"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={3}
            placeholder="Reply in this chat"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={pending || draft.trim().length === 0}
            className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(81,69,219,0.28)] disabled:opacity-40 ${HALO}`}
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

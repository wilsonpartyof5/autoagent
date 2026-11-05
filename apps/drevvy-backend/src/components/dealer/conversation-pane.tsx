'use client';

import { useState } from 'react';
import Link from 'next/link';

import {
  markConversationSold,
  postConversationMessage,
  shareConversationNumbers,
} from '@/app/dealer/actions';
import { shopperDeskLabel } from '@/lib/dealer/demo-org';
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

const ERROR_COPY: Record<DealerDemoError, string> = {
  not_found: 'That conversation is not in this inbox.',
  empty_message: 'Write a message first.',
  message_too_long: 'That message is too long.',
  invalid_price: 'Enter a price in dollars, at least $1.',
  conversation_closed: 'Closed conversations stay closed.',
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
  const [docFee, setDocFee] = useState('');
  const [tax, setTax] = useState('');
  const [titleFee, setTitleFee] = useState('');
  const [registration, setRegistration] = useState('');
  const [otd, setOtd] = useState('');
  const [note, setNote] = useState('');
  const [showNumbers, setShowNumbers] = useState(false);
  const [confirmSold, setConfirmSold] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const open = isOpenStage(conversation.stage);
  const deskName = shopperDeskLabel(
    conversation.shopperFirstName,
    conversation.shopperRef
  );

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
    const anyLine = [docFee, tax, titleFee, registration].some(value => value.trim().length > 0);
    let lines: {
      vehiclePriceCents: number;
      docFeeCents: number;
      taxCents: number;
      titleCents: number;
      registrationCents: number;
    } | null = null;
    if (anyLine) {
      const docFeeCents = dollarsToCents(docFee);
      const taxCents = dollarsToCents(tax);
      const titleCents = dollarsToCents(titleFee);
      const registrationCents = dollarsToCents(registration);
      if (
        docFeeCents == null
        || taxCents == null
        || titleCents == null
        || registrationCents == null
      ) {
        setError('Enter vehicle price, doc fee, tax, title, and registration.');
        return;
      }
      lines = {
        vehiclePriceCents: statedPriceCents,
        docFeeCents,
        taxCents,
        titleCents,
        registrationCents,
      };
    }
    setPending(true);
    const result = await shareConversationNumbers(conversation.id, {
      statedPriceCents,
      writtenOtdCents: written,
      note,
      lines,
    });
    setPending(false);
    if (!result.ok) {
      setError(ERROR_COPY[result.error]);
      return;
    }
    setStated('');
    setDocFee('');
    setTax('');
    setTitleFee('');
    setRegistration('');
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
    <section className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="av">{conversation.shopperFirstName.slice(0, 1)}</div>
          <div>
            <Link href="/dealer/inbox" className="mut md:hidden">
              Inbox
            </Link>
            <div className="t">{deskName}</div>
            <div className="mut">
              {conversation.vehicleTitle} · started via Drevvy
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StageChip stage={conversation.stage} label={conversation.stageLabel} />
          <SlaText sla={conversation.sla} />
          <button
            type="button"
            disabled={!open}
            onClick={() => {
              setShowNumbers(false);
              setConfirmSold(value => !value);
            }}
            className="btn2"
          >
            Mark sold
          </button>
        </div>
      </header>
      <PriceLine
        advertisedPriceCents={conversation.advertisedPriceCents}
        statedPriceCents={conversation.statedPriceCents}
        priceDiffers={conversation.priceDiffers}
      />
      <StageStepper stage={conversation.stage} />
      <div className="note">
        Message-only. Shopper first name is shown in-dashboard; contact details
        stay private. Live in-network chats open with the itemized out-the-door
        ask. Shopper chips are suggestions the shopper taps. Nothing is sent
        until the shopper taps. A missing itemized price warns the salesperson
        and the internet manager on this thread. This desk does not text,
        email, or call.
        {conversation.fixtureLabel ? ` ${conversation.fixtureLabel}.` : ''}
      </div>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {conversation.messages.map(message => {
          if (message.kind === 'numbers') {
            return (
              <li key={message.id}>
                <div className="otd">
                  <p className="lab">Share itemized OTD · Informational card</p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  <p className="mut" style={{ marginTop: 8 }}>
                    {SHARE_NUMBERS_DISCLAIMER}
                  </p>
                  <p className="mut">{formatStamp(message.sentAt)}</p>
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
              : conversation.shopperFirstName;
          return (
            <li key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`bub ${mine ? 'me' : 'them'}`}>
                <p className="lab">
                  {label}
                  {opener ? ' · Templated opener' : ''}
                </p>
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className="mut">{formatStamp(message.sentAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div>
        {confirmSold && open ? (
          <div className="otd" style={{ marginBottom: 12 }}>
            <p className="t">Mark as sold</p>
            <p className="mut" style={{ marginTop: 6 }}>
              {MARK_SOLD_CONFIRM}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={confirmMarkSold}
                disabled={pending}
                className="btn"
              >
                Mark sold
              </button>
              <button
                type="button"
                onClick={() => setConfirmSold(false)}
                className="btn2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {showNumbers && open ? (
          <div className="otd" style={{ marginBottom: 12 }}>
            <p className="t">Share itemized OTD</p>
            <p className="mut" style={{ marginTop: 6 }}>
              {SHARE_NUMBERS_DISCLAIMER} Vehicle, doc fee, tax, tag/title, and
              any add-ons — line by line.
            </p>
            <p className="mut" style={{ marginTop: 8 }}>
              Advertised {formatMoney(conversation.advertisedPriceCents)}
            </p>
            <label className="lab" htmlFor="stated-price">
              Vehicle price
            </label>
            <input
              id="stated-price"
              className="inp"
              value={stated}
              onChange={event => setStated(event.target.value)}
              inputMode="decimal"
              placeholder="35400"
            />
            <label className="lab" htmlFor="doc-fee">
              Doc fee
            </label>
            <input
              id="doc-fee"
              className="inp"
              value={docFee}
              onChange={event => setDocFee(event.target.value)}
              inputMode="decimal"
              placeholder="499"
            />
            <label className="lab" htmlFor="tax-line">
              Tax
            </label>
            <input
              id="tax-line"
              className="inp"
              value={tax}
              onChange={event => setTax(event.target.value)}
              inputMode="decimal"
              placeholder="1800"
            />
            <label className="lab" htmlFor="title-line">
              Title
            </label>
            <input
              id="title-line"
              className="inp"
              value={titleFee}
              onChange={event => setTitleFee(event.target.value)}
              inputMode="decimal"
              placeholder="150"
            />
            <label className="lab" htmlFor="registration-line">
              Registration
            </label>
            <input
              id="registration-line"
              className="inp"
              value={registration}
              onChange={event => setRegistration(event.target.value)}
              inputMode="decimal"
              placeholder="210"
            />
            <label className="lab" htmlFor="otd-price">
              Written out-the-door total (optional)
            </label>
            <input
              id="otd-price"
              className="inp"
              value={otd}
              onChange={event => setOtd(event.target.value)}
              inputMode="decimal"
              placeholder="38950"
            />
            <label className="lab" htmlFor="numbers-note">
              Note (optional)
            </label>
            <textarea
              id="numbers-note"
              className="inp"
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={2}
            />
            <button
              type="button"
              onClick={share}
              disabled={pending}
              className="btn"
              style={{ marginTop: 10 }}
            >
              Share in chat
            </button>
          </div>
        ) : null}

        <div>
          {conversation.replyTemplates.map(template => (
            <button
              key={template.id}
              type="button"
              className={`cp${template.id === 'otd' ? ' p' : ''}`}
              onClick={() => {
                setDraft(template.text);
                if (template.id === 'otd') {
                  setConfirmSold(false);
                  setShowNumbers(true);
                }
              }}
            >
              {template.label}
            </button>
          ))}
        </div>
        {!open ? (
          <p className="mut" style={{ marginBottom: 8 }}>
            Closed conversations stay closed. You can still read the thread.
          </p>
        ) : null}
        {error ? (
          <p className="dn" role="alert">
            {error}
          </p>
        ) : null}
        <div className="composer">
          <label className="sr-only" htmlFor="chat-composer">
            Reply to {conversation.shopperFirstName}
          </label>
          <input
            id="chat-composer"
            className="inp"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={`Reply to ${conversation.shopperFirstName}…`}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={pending || draft.trim().length === 0}
            className="btn"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

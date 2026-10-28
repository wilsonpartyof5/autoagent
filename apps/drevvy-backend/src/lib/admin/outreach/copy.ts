import { AGENT_OPENER_TEMPLATE, CALL_OPENER } from '../../agent-voice';
import { availabilityQuestion, listingIdent, spokenAvailabilityQuestion } from './opener';
import { DREVVY_NUMBER, type CallOutcome, type TouchpointId, type Variant } from './types';

const OPENER = AGENT_OPENER_TEMPLATE;

export type CopyContext = {
  first: string;
  vehicle: string;
  vehicleShort: string;
  stock: string;
  price: string;
  number: string;
  vin?: string;
  /** Salesperson first name, when we know who will read the message. */
  dealerFirst?: string | null;
  /** True only when a text was actually sent before this message. */
  textSent?: boolean;
};

export function fill(template: string, ctx: CopyContext): string {
  const ask = availabilityQuestion({
    dealerFirstName: ctx.dealerFirst,
    stock: ctx.stock,
    vin: ctx.vin,
  });
  const spoken = spokenAvailabilityQuestion({ stock: ctx.stock, vin: ctx.vin });
  const ident = listingIdent({ stock: ctx.stock, vin: ctx.vin });
  const channels = ctx.textSent ? 'email, text, and phone' : 'email and phone';
  return template
    .replace(/\{ask\}/g, ask)
    .replace(/\{spoken\}/g, spoken)
    .replace(/\{ident\}/g, ident)
    .replace(/\{channels\}/g, channels)
    .replace(/\{first\}/g, ctx.first)
    .replace(/\{vehicle_short\}/g, ctx.vehicleShort)
    .replace(/\{vehicle\}/g, ctx.vehicle)
    .replace(/\{stock\}/g, ctx.stock)
    .replace(/\{price\}/g, ctx.price)
    .replace(/\{number\}/g, ctx.number);
}

const EMAIL: Partial<Record<TouchpointId, Record<Variant, { subject: string; body: string }>>> = {
  'D0-E1': {
    A: {
      subject: 'Still available? {ident}',
      body: `{ask}\n\n{first}`,
    },
    B: {
      subject: 'Is {ident} still available?',
      body: `{ask}\n\n{first}`,
    },
    C: {
      subject: 'Still available: {ident}',
      body: `{ask}\n\n{first}`,
    },
  },
  'D1-E2': {
    A: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} Following up on the {vehicle} (#{stock}). Could you send an itemized out-the-door price? Text {number} or reply here. Thanks!\n\nDrevvy, on behalf of {first}`,
    },
    B: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} They're deciding on a {vehicle_short} soon, and #{stock} is the one they're watching. Could you send an itemized out-the-door price? Text {number} or reply here.\n\nDrevvy, on behalf of {first}`,
    },
    C: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} Could you share an itemized out-the-door price on the {vehicle} (#{stock})? Text {number} or reply here.\n\nDrevvy, on behalf of {first}`,
    },
  },
  'D6-E3': {
    A: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} We'll close the request on the {vehicle} (#{stock}) tomorrow. If it's still available, text {number} or reply with your itemized out-the-door price and we'll pass it to {first}.\n\nDrevvy, on behalf of {first}`,
    },
    B: {
      subject: 'Closing tomorrow: {vehicle}, stock #{stock}',
      body: `${OPENER} We'll close the request on the {vehicle} (#{stock}) tomorrow. If it's still available, text {number} or reply with your itemized out-the-door price and we'll pass it to {first}.\n\nDrevvy, on behalf of {first}`,
    },
    C: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} We'd still like to work with you on the {vehicle} (#{stock}). We'll close the request tomorrow. Text {number} or reply with an itemized out-the-door price.\n\nDrevvy, on behalf of {first}`,
    },
  },
  'D7-E4': {
    A: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} We've reached out by {channels} about the {vehicle} (#{stock}) and don't have an out-the-door price, so we're closing this request today. If you'd still like to earn their business, reply with an itemized out-the-door price and we'll pass it to {first}.\n\nDrevvy, on behalf of {first}`,
    },
    B: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} Shoppers choose dealers who share a clear, itemized price. We're closing the request on the {vehicle} (#{stock}) today. Reply or text {number} with your out-the-door price and it goes straight to {first}.\n\nDrevvy, on behalf of {first}`,
    },
    C: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: `${OPENER} We haven't received an out-the-door price on the {vehicle} (#{stock}), so we're closing the request today. Reply or text {number} with an itemized price and we'll pass it along.\n\nDrevvy, on behalf of {first}`,
    },
  },
};

/**
 * Texts are replies, sent only after a salesperson texts us.
 * D0-T1 is the wording for that first reply. It is not on the sample cadence,
 * and nothing sends it to a dealer's main line.
 */
const SMS: Partial<Record<TouchpointId | 'D0-T1', Record<Variant, string>>> = {
  'D0-T1': {
    A: `{ask} Reply STOP to opt out`,
    B: `{ask} Reply STOP to opt out`,
    C: `{ask} Reply STOP to opt out`,
  },
  'D0-TS': {
    A: `{ask} Reply STOP to opt out`,
    B: `{ask} Your team said to text this number. Reply STOP to opt out`,
    C: `{ask} Reply STOP to opt out`,
  },
  'D1-T2': {
    A: `${OPENER} Still interested in the {vehicle_short} (#{stock}). Could you text the out-the-door price, itemized?`,
    B: `${OPENER} Still interested in #{stock}. Out-the-door price?`,
    C: `${OPENER} A one-line out-the-door price on #{stock} is all we need. Thanks!`,
  },
  'D2-T3': {
    A: `${OPENER} Just called about the {vehicle_short} (#{stock}). Could you text the out-the-door price?`,
    B: `${OPENER} Is the {vehicle_short} #{stock} still available?`,
    C: `${OPENER} A clear out-the-door price on the {vehicle_short} (#{stock}) is all we need.`,
  },
  'D6-T4': {
    A: `${OPENER} We'll close the request on #{stock} tomorrow. Still available? Text the out-the-door price and we'll pass it on.`,
    B: `${OPENER} Last note on #{stock}. Out-the-door price by tomorrow?`,
    C: `${OPENER} We'd still like to work with you on #{stock}. Text an itemized out-the-door price before tomorrow and it goes to {first}.`,
  },
};

export function emailCopy(touchpoint: TouchpointId, variant: Variant, ctx: CopyContext): { subject: string; body: string } | null {
  const row = EMAIL[touchpoint]?.[variant];
  if (!row) return null;
  return { subject: fill(row.subject, ctx), body: fill(row.body, ctx) };
}

export function smsCopy(touchpoint: TouchpointId | 'D0-T1', variant: Variant, ctx: CopyContext): string | null {
  const row = SMS[touchpoint]?.[variant];
  return row ? fill(row, ctx) : null;
}

/** Calls open with a short hello for the buyer. They do not say "I'm an AI" or "automated assistant". */
export function callOpener(touchpoint: 'D0-C1' | 'D0-C2' | 'D2-C3', variant: Variant, ctx: CopyContext): string {
  if (touchpoint === 'D0-C1') {
    return fill(`${CALL_OPENER} {spoken}`, ctx);
  }
  if (touchpoint === 'D0-C2') {
    if (variant === 'C') {
      return fill(`${CALL_OPENER} Calling again about your {vehicle}, stock {stock}. What's the best number to text a salesperson?`, ctx);
    }
    return fill(`${CALL_OPENER} We emailed and called earlier about your {vehicle}, stock {stock}. What's the best number to text a salesperson?`, ctx);
  }
  if (variant === 'C') {
    return fill(`${CALL_OPENER} Still on your {vehicle}, stock {stock}. What's the best number to text a salesperson?`, ctx);
  }
  return fill(`${CALL_OPENER} They're still interested in your {vehicle}, stock {stock}. What's the best number to text a salesperson?`, ctx);
}

export function voicemailScript(ctx: CopyContext): string {
  return fill(
    `${CALL_OPENER} {spoken} Please text {number} if it is. Again, {number}. Thanks!`,
    ctx,
  );
}

export function callTranscript(
  touchpoint: 'D0-C1' | 'D0-C2' | 'D2-C3',
  variant: Variant,
  ctx: CopyContext,
  outcome: CallOutcome,
  capturedNumber: string | null,
): { transcript: string; summary: string; durationS: number } {
  const opener = callOpener(touchpoint, variant, ctx);
  if (outcome === 'no_answer') {
    return { transcript: `${opener}\n\nNo answer. Did not leave a voicemail.`, summary: 'No answer on the main line.', durationS: 18 };
  }
  if (outcome === 'voicemail') {
    return {
      transcript: `${opener}\n\nReached voicemail. Left VM-1.`,
      summary: 'Voicemail. Left the short OTD ask.',
      durationS: 16,
    };
  }
  if (outcome === 'number_captured' && capturedNumber) {
    return {
      transcript: `${opener}\nDealer: Sales desk is ${capturedNumber}.\nDrevvy: That's ${capturedNumber}. Thanks so much!`,
      summary: `Captured salesperson number ${capturedNumber}.`,
      durationS: 46,
    };
  }
  if (outcome === 'transferred') {
    return {
      transcript: `${opener}\nDealer: Let me transfer you.\nDrevvy: What's the best number to text a salesperson about this ${ctx.vehicleShort}?\nDealer: Have them come in and we'll take care of them.\nDrevvy: We'll pass that along. Text is the fastest way to reach ${ctx.first} through us: ${ctx.number}.`,
      summary: 'Transferred. No number. Asked the buyer to come in.',
      durationS: 62,
    };
  }
  if (outcome === 'sold') {
    return {
      transcript: `${opener}\nDealer: That one sold this morning.\nDrevvy: Just to confirm, stock ${ctx.stock} has sold?\nDealer: Yes.\nDrevvy: Thanks for telling us.`,
      summary: `Dealer confirmed stock ${ctx.stock} sold.`,
      durationS: 34,
    };
  }
  return {
    transcript: `${opener}\nDealer: Don't call this store.\nDrevvy: Understood. We'll stop calling. Sorry to interrupt.`,
    summary: 'Dealer asked us not to call. Calls opted out.',
    durationS: 22,
  };
}

export function inboundReply(kind: 'otd' | 'come_in' | 'need_phone' | 'credit_app' | 'stop', ctx: CopyContext): string {
  if (kind === 'otd') return `OTD on stock ${ctx.stock} is $31,480 including tax, doc, and title. Text works.`;
  if (kind === 'come_in') return `Have ${ctx.first} come in. We don't quote out the door over text.`;
  if (kind === 'need_phone') return `I need ${ctx.first}'s phone number before I can work a price.`;
  if (kind === 'credit_app') return 'Send a credit app and have them come in. Then we can talk price.';
  return 'STOP';
}

export function defaultCopyContext(partial: Omit<CopyContext, 'number'>): CopyContext {
  return { ...partial, number: DREVVY_NUMBER };
}

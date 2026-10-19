import { AGENT_OPENER_TEMPLATE, CALL_OPENER } from '../../agent-voice';
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
  /** True only when a text was actually sent before this message. */
  textSent?: boolean;
};

/** Day-0 email names the stock number and the VIN, and asks only if it is still available. */
export function day0AvailabilityAsk(ctx: Pick<CopyContext, 'vehicle' | 'stock' | 'vin'>): string {
  const stock = ctx.stock.trim().replace(/^#/, '');
  const vin = ctx.vin?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') ?? '';
  const bits = [stock ? `stock #${stock}` : '', vin ? `VIN ${vin}` : ''].filter(Boolean);
  const vehicle = ctx.vehicle.trim();
  if (bits.length === 0) return `Is the ${vehicle} still available?`;
  return `Is the ${vehicle}, ${bits.join(', ')}, still available?`;
}

export function fill(template: string, ctx: CopyContext): string {
  const channels = ctx.textSent ? 'email, text, and phone' : 'email and phone';
  return template
    .replace(/\{ask\}/g, day0AvailabilityAsk(ctx))
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
      subject: 'Still available? {vehicle}, stock #{stock}',
      body: `${OPENER} {ask}\n\nThanks!\nDrevvy, on behalf of {first}`,
    },
    B: {
      subject: 'Is the {vehicle_short} (#{stock}) still available?',
      body: `${OPENER} Quick question. {ask}\n\nThanks!\nDrevvy, on behalf of {first}`,
    },
    C: {
      subject: 'Still available: {vehicle}, stock #{stock}',
      body: `${OPENER}\n\n{ask}\n\nThanks!\nDrevvy, on behalf of {first}`,
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
  'D4-E3': {
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
  'D5-E4': {
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
 * There is no cold Day-0 text to the dealer's main line.
 */
const SMS: Partial<Record<TouchpointId, Record<Variant, string>>> = {
  'D0-TS': {
    A: `${OPENER} Your store gave us this number for the {vehicle_short} (#{stock}). Out-the-door price, itemized? Reply STOP to opt out`,
    B: `${OPENER} Your team said to text about the {vehicle_short} #{stock}. What's the out-the-door price? Reply STOP to opt out`,
    C: `${OPENER} We'd love a clear out-the-door price on the {vehicle_short} (#{stock}). Reply STOP to opt out`,
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
  'D4-T4': {
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

export function smsCopy(touchpoint: TouchpointId, variant: Variant, ctx: CopyContext): string | null {
  const row = SMS[touchpoint]?.[variant];
  return row ? fill(row, ctx) : null;
}

/** Calls open with a short hello for the buyer. They do not say "I'm an AI" or "automated assistant". */
export function callOpener(touchpoint: 'D0-C1' | 'D0-C2' | 'D2-C3', variant: Variant, ctx: CopyContext): string {
  if (touchpoint === 'D0-C1') {
    if (variant === 'B') {
      return fill(`${CALL_OPENER} Who should we text about your {vehicle}, stock {stock}?`, ctx);
    }
    if (variant === 'C') {
      return fill(`${CALL_OPENER} We'd like to text a salesperson about your {vehicle}, stock {stock}. What's the best number?`, ctx);
    }
    return fill(`${CALL_OPENER} What's the best number to text a salesperson about your {vehicle}, stock {stock}?`, ctx);
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
    `${CALL_OPENER} They're interested in your {vehicle}, stock {stock}. Please text the out-the-door price to {number}. Again, {number}. Thanks!`,
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

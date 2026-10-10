import { DREVVY_NUMBER, type CallOutcome, type TouchpointId, type Variant } from './types';

export type CopyContext = {
  first: string;
  vehicle: string;
  vehicleShort: string;
  stock: string;
  price: string;
  number: string;
};

export function fill(template: string, ctx: CopyContext): string {
  return template
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
      subject: 'Real buyer: {vehicle}, stock #{stock}',
      body: 'Hi, this is Drevvy. We\'re helping {first}, a real buyer interested in your {vehicle} (stock #{stock}) listed at {price}.\n\nCould you send your out-the-door price with taxes and fees itemized? Text is easiest: {number}. Replying to this email works too.\n\nWe\'re here to help you sell this car and get {first} a clear, transparent number. Thanks!\n\nDrevvy, on behalf of {first}',
    },
    B: {
      subject: 'Out-the-door price on your {price} {vehicle_short}? (#{stock})',
      body: 'Hi, this is Drevvy. We\'re helping {first}, a real buyer interested in your {vehicle} (stock #{stock}) listed at {price}.\n\nCould you send your out-the-door price with taxes and fees itemized? Text is easiest: {number}. Replying to this email works too.\n\nWe\'re here to help you sell this car and get {first} a clear, transparent number. Thanks!\n\nDrevvy, on behalf of {first}',
    },
    C: {
      subject: 'Real buyer: {vehicle}, stock #{stock}',
      body: 'Hi, Drevvy here for {first}, a real buyer.\n\nWhat\'s your out-the-door price on the {vehicle} (#{stock}, listed at {price}), with taxes and fees itemized? Text {number} or just reply here.\n\nThanks for helping us keep it transparent!\nDrevvy, on behalf of {first}',
    },
  },
  'D1-E2': {
    A: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi, just following up for {first} on the {vehicle} (#{stock}). Could you send an itemized out-the-door price? Text {number} or reply here. Thanks!\n\nDrevvy, on behalf of {first}',
    },
    B: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi, {first} is looking to decide on a {vehicle_short} soon and yours (#{stock}) is the one they\'re watching. Could you send an itemized out-the-door price? Text {number} or reply here.\n\nDrevvy, on behalf of {first}',
    },
    C: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi, Drevvy buyers choose dealers based on clear, upfront pricing. Could you share an itemized out-the-door price on the {vehicle} (#{stock}) for {first}? Text {number} or reply here.\n\nDrevvy, on behalf of {first}',
    },
  },
  'D4-E3': {
    A: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi, Drevvy here for {first}. We\'ll close {first}\'s request on the {vehicle} (#{stock}) tomorrow. If it\'s still available, text {number} or reply with your itemized out-the-door price and we\'ll pass it straight to {first}.\n\nDrevvy, on behalf of {first}',
    },
    B: {
      subject: 'Closing tomorrow: {vehicle}, stock #{stock}',
      body: 'Hi, Drevvy here for {first}. We\'ll close {first}\'s request on the {vehicle} (#{stock}) tomorrow. If it\'s still available, text {number} or reply with your itemized out-the-door price and we\'ll pass it straight to {first}.\n\nDrevvy, on behalf of {first}',
    },
    C: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi, we\'d still love to work with you on the {vehicle} (#{stock}). {first} is picking a dealer based on clear, upfront pricing, and we\'ll close the request tomorrow. Text {number} or reply with an itemized out-the-door price.\n\nDrevvy, on behalf of {first}',
    },
  },
  'D5-E4': {
    A: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi again. Drevvy here, on behalf of {first}, a real buyer for your {vehicle} (#{stock}). We\'ve reached out by email, text and phone this week and haven\'t been able to get an out-the-door price. {first} is choosing a dealer based on transparent pricing, so we\'re closing this request today. If you\'d still like to earn their business, reply with an itemized out-the-door price and we\'ll pass it straight to {first}.\n\nDrevvy, on behalf of {first}',
    },
    B: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi again. Drevvy here for {first}, a real buyer for your {vehicle} (#{stock}). Buyers on Drevvy choose the dealers who share a clear, itemized price up front. We\'re closing {first}\'s request today, but if you\'d still like to earn their business, reply or text {number} with your out-the-door price and it goes straight to {first}.\n\nDrevvy, on behalf of {first}',
    },
    C: {
      subject: 'Re: {vehicle}, stock #{stock}',
      body: 'Hi again. Just a reminder that {first} is a real person, ready to buy your {vehicle} (#{stock}) with a clear, transparent number. We haven\'t received an out-the-door price, so we\'re closing the request today. If you\'d still like to work with {first}, reply or text {number} with an itemized price and we\'ll pass it straight along.\n\nDrevvy, on behalf of {first}',
    },
  },
};

const SMS: Partial<Record<TouchpointId, Record<Variant, string>>> = {
  'D0-T1': {
    A: 'Hi, Drevvy here for {first}, a real buyer for your {vehicle_short} (#{stock}). Just emailed & called. What\'s your out-the-door price, itemized? Reply STOP to opt out',
    B: 'What\'s your out-the-door price on the {vehicle_short} #{stock}, taxes & fees itemized? Drevvy here, for {first}, a real buyer. Reply STOP to opt out',
    C: 'Hi, Drevvy here for {first}, a real buyer for your {vehicle_short} (#{stock}). {first} is choosing on transparent pricing. Your out-the-door price? Reply STOP to opt out',
  },
  'D0-TS': {
    A: 'Hi, Drevvy here. Your store gave us this number. {first}, a real buyer, wants your {vehicle_short} (#{stock}). Out-the-door price, itemized? Reply STOP to opt out',
    B: 'Hi! Your team said to text you. Drevvy here for {first}, a real buyer for the {vehicle_short} #{stock}. What\'s the out-the-door price? Reply STOP to opt out',
    C: 'Hi, Drevvy here for {first}, a real buyer for your {vehicle_short} (#{stock}). We\'d love a clear, transparent out-the-door price from you. Reply STOP to opt out',
  },
  'D1-T2': {
    A: 'Drevvy again for {first} on the {vehicle_short} (#{stock}). Still interested! Could you text your out-the-door price, itemized?',
    B: 'Drevvy for {first}: still interested in #{stock}. OTD price?',
    C: 'Quick one from Drevvy: a one-line reply with your out-the-door price on #{stock} is all {first} needs. Thanks!',
  },
  'D2-T3': {
    A: 'Drevvy for {first}, a real buyer for your {vehicle_short} (#{stock}). Just called. Could you text your out-the-door price?',
    B: 'Is the {vehicle_short} #{stock} still available? Drevvy here for {first}, a real buyer.',
    C: '{first} is still set on your {vehicle_short} (#{stock}). Drevvy here. A clear out-the-door price is all we need.',
  },
  'D4-T4': {
    A: 'Drevvy for {first}: we\'ll close {first}\'s request on #{stock} tomorrow. Still available? Text your out-the-door price and we\'ll pass it on.',
    B: 'Last call from Drevvy for {first} on #{stock}. Out-the-door price by tomorrow?',
    C: 'Drevvy for {first}: we\'d still love to work with you on #{stock}. Text an itemized out-the-door price before tomorrow and it goes straight to {first}.',
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

/** Calls introduce Drevvy by name for the buyer. They do not say "automated assistant". */
export function callOpener(touchpoint: 'D0-C1' | 'D0-C2' | 'D2-C3', variant: Variant, ctx: CopyContext): string {
  if (touchpoint === 'D0-C1') {
    if (variant === 'B') {
      return fill('Hi, this is Drevvy. What\'s the best number to text a salesperson about your {vehicle}, stock {stock}? We\'re calling for {first}, a real buyer.', ctx);
    }
    if (variant === 'C') {
      return fill('Hi, this is Drevvy calling for {first}. What\'s the best number to text a salesperson about your {vehicle}, stock {stock}?', ctx);
    }
    return fill('Hi, this is Drevvy calling for {first}, a real buyer, about your {vehicle}, stock {stock}. We\'d love to text a salesperson. What\'s the best number?', ctx);
  }
  if (touchpoint === 'D0-C2') {
    if (variant === 'C') {
      return fill('Hi, this is Drevvy calling again for {first} about your {vehicle}, stock {stock}. What\'s the best number to text a salesperson?', ctx);
    }
    return fill('Hi, this is Drevvy again, calling for {first}, a real buyer, about your {vehicle}, stock {stock}. We emailed and called earlier. What\'s the best number to text a salesperson?', ctx);
  }
  if (variant === 'C') {
    return fill('Hi, this is Drevvy calling for {first}. They\'re still interested in your {vehicle}, stock {stock}. What\'s the best number to text a salesperson?', ctx);
  }
  return fill('Hi, this is Drevvy calling for {first}, a real buyer still interested in your {vehicle}, stock {stock}. What\'s the best number to text a salesperson?', ctx);
}

export function voicemailScript(ctx: CopyContext): string {
  return fill(
    'Hi, this is Drevvy, calling for {first}, a real buyer interested in your {vehicle}, stock {stock}. Please text us your out-the-door price at {number}. Again, {number}. Thanks!',
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

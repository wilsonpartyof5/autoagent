/**
 * Labeled dealer replies for the model bakeoff.
 * expectedAmounts lists dollars the message actually states (null means the
 * field must stay unknown). abstain means every other quote field stays null.
 */

import type { ProposedAction } from '../proposal';
import type { QuoteField } from '../quote';

export type EvalCase = {
  id: string;
  message: string;
  expectedAmounts: Partial<Record<QuoteField, number | null>>;
  allowedAction: ProposedAction[];
  abstain: boolean;
  tags: string[];
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'stop-short',
    message: 'STOP',
    expectedAmounts: {},
    allowedAction: ['wait'],
    abstain: true,
    tags: ['short', 'opt_out'],
  },
  {
    id: 'stop-slang',
    message: 'stop texting me bro',
    expectedAmounts: {},
    allowedAction: ['wait'],
    abstain: true,
    tags: ['short', 'slang', 'opt_out'],
  },
  {
    id: 'thanks-short',
    message: 'k thanks',
    expectedAmounts: {},
    allowedAction: ['wait'],
    abstain: true,
    tags: ['short'],
  },
  {
    id: 'slang-racks',
    message: 'yea we can do 32 racks OTD',
    expectedAmounts: { dealer_stated_otd: 32000 },
    allowedAction: ['ask_for_itemization', 'request_fee_clarification'],
    abstain: true,
    tags: ['slang', 'incomplete'],
  },
  {
    id: 'slang-hundo',
    message: 'doc fee is five hundo, car is 25 grand',
    expectedAmounts: { vehicle_price: 25000, doc_fee: 500 },
    allowedAction: ['ask_for_itemization', 'request_fee_clarification'],
    abstain: true,
    tags: ['slang', 'doc_fee', 'incomplete'],
  },
  {
    id: 'incomplete-sticker',
    message: 'The car is $28,995.',
    expectedAmounts: { vehicle_price: 28995 },
    allowedAction: ['ask_for_itemization'],
    abstain: true,
    tags: ['incomplete'],
  },
  {
    id: 'incomplete-about',
    message: 'Out the door is about 34k',
    expectedAmounts: { dealer_stated_otd: 34000 },
    allowedAction: ['ask_for_itemization', 'request_fee_clarification'],
    abstain: true,
    tags: ['incomplete', 'ambiguous'],
  },
  {
    id: 'contradictory-otd-ignores-tax',
    message: 'Price is $30,000. OTD is $30,000 but tax is $2,100 and doc is $599.',
    expectedAmounts: {
      vehicle_price: 30000,
      dealer_stated_otd: 30000,
      tax: 2100,
      doc_fee: 599,
    },
    allowedAction: ['request_fee_clarification'],
    abstain: true,
    tags: ['contradictory', 'doc_fee', 'tax'],
  },
  {
    id: 'contradictory-two-totals',
    message: 'OTD is $31,200. Actually the total due at signing is $33,450.',
    expectedAmounts: { dealer_stated_otd: null },
    allowedAction: ['request_fee_clarification'],
    abstain: true,
    tags: ['contradictory'],
  },
  {
    id: 'itemized-doc-tax',
    message: 'Selling price $27,400, doc fee $699, tax $1,644, title $85, registration $120. OTD $29,948.',
    expectedAmounts: {
      vehicle_price: 27400,
      doc_fee: 699,
      tax: 1644,
      title_fee: 85,
      registration_fee: 120,
      dealer_stated_otd: 29948,
    },
    allowedAction: ['send_reply', 'wait'],
    abstain: false,
    tags: ['doc_fee', 'tax', 'complete'],
  },
  {
    id: 'high-doc-fee',
    message: 'MSRP $35,000, doc fee $1,895, tax $2,100, title $75, registration $150. Out the door $39,220.',
    expectedAmounts: {
      vehicle_price: 35000,
      doc_fee: 1895,
      tax: 2100,
      title_fee: 75,
      registration_fee: 150,
      dealer_stated_otd: 39220,
    },
    allowedAction: ['send_reply', 'request_fee_clarification', 'wait'],
    abstain: false,
    tags: ['doc_fee', 'tax'],
  },
  {
    id: 'zero-doc-with-tax',
    message: 'No doc fee. Price $25,000 plus 6% tax ($1,500). Title $50. Registration $100. OTD $26,650.',
    expectedAmounts: {
      vehicle_price: 25000,
      doc_fee: 0,
      tax: 1500,
      title_fee: 50,
      registration_fee: 100,
      dealer_stated_otd: 26650,
    },
    allowedAction: ['send_reply', 'wait'],
    abstain: false,
    tags: ['doc_fee', 'tax', 'complete'],
  },
  {
    id: 'plus-ttl',
    message: '$25,000 plus tax and title',
    expectedAmounts: { vehicle_price: 25000, tax: null, title_fee: null },
    allowedAction: ['ask_for_itemization'],
    abstain: true,
    tags: ['incomplete', 'tax', 'ambiguous'],
  },
  {
    id: 'come-in-when',
    message: 'When can you come in?',
    expectedAmounts: {},
    allowedAction: ['send_reply', 'wait'],
    abstain: true,
    tags: ['come_in', 'price_first', 'short'],
  },
  {
    id: 'come-in-and-talk',
    message: "Come in and we'll talk. I can't do numbers over text.",
    expectedAmounts: {},
    allowedAction: ['send_reply', 'wait'],
    abstain: true,
    tags: ['come_in', 'pressure', 'price_first'],
  },
  {
    id: 'pressure-expires',
    message: "This deal won't last the day. Come in NOW or it's gone. OTD $31,000 firm.",
    expectedAmounts: { dealer_stated_otd: 31000 },
    allowedAction: ['send_reply', 'wait', 'escalate', 'ask_for_itemization'],
    abstain: true,
    tags: ['pressure', 'no_commitment', 'incomplete'],
  },
  {
    id: 'pressure-rebate',
    message: "If you don't buy today the rebate disappears. Just give me a yes.",
    expectedAmounts: {},
    allowedAction: ['escalate', 'wait', 'send_reply'],
    abstain: true,
    tags: ['pressure', 'no_commitment'],
  },
  {
    id: 'phone-request',
    message: "What's the customer's phone number?",
    expectedAmounts: {},
    allowedAction: ['send_reply', 'wait'],
    abstain: true,
    tags: ['phone_request', 'price_first', 'short'],
  },
  {
    id: 'phone-and-email',
    message: "Text me the buyer's cell and email so my manager can reach them.",
    expectedAmounts: {},
    allowedAction: ['send_reply', 'wait'],
    abstain: true,
    tags: ['phone_request', 'price_first'],
  },
  {
    id: 'quote-attached',
    message: 'Quote attached.',
    expectedAmounts: {},
    allowedAction: ['ask_for_itemization', 'wait'],
    abstain: true,
    tags: ['quote_attached', 'short'],
  },
  {
    id: 'quote-attached-total',
    message: 'Quote attached. Bottom line $36,400 OTD.',
    expectedAmounts: { dealer_stated_otd: 36400 },
    allowedAction: ['ask_for_itemization', 'request_fee_clarification'],
    abstain: true,
    tags: ['quote_attached', 'incomplete'],
  },
  {
    id: 'slang-no-split',
    message: 'we out the door at thirty two five, fees included idk the split',
    expectedAmounts: { dealer_stated_otd: 32500 },
    allowedAction: ['ask_for_itemization', 'request_fee_clarification'],
    abstain: true,
    tags: ['slang', 'incomplete', 'ambiguous'],
  },
  {
    id: 'conflicting-doc',
    message: 'Doc fee is $399. Actually doc is $899. Tax $1,800. Car is $20,000.',
    expectedAmounts: { vehicle_price: 20000, doc_fee: null, tax: 1800 },
    allowedAction: ['request_fee_clarification'],
    abstain: true,
    tags: ['contradictory', 'doc_fee', 'tax'],
  },
  {
    id: 'destination-and-tax',
    message: 'Vehicle $22,000, destination $1,195, doc $499, sales tax $1,464, title $72, registration $98. Total OTD $25,328.',
    expectedAmounts: {
      vehicle_price: 22000,
      destination_fee: 1195,
      doc_fee: 499,
      tax: 1464,
      title_fee: 72,
      registration_fee: 98,
      dealer_stated_otd: 25328,
    },
    allowedAction: ['send_reply', 'wait'],
    abstain: false,
    tags: ['doc_fee', 'tax', 'complete'],
  },
];

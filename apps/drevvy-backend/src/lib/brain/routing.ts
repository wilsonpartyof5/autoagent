/**
 * Chooses the fast model or the main model before a proposal call.
 * Clear opt-out, "quote attached", and "when can you come in" stay on the
 * fast model. Money, fees, conflicts, and hedges go to the main model.
 */

import { detectSmsOptOut } from '../sms/opt-out';

export type RouteLane = 'fast' | 'main';

export type SimpleClass = 'opt_out' | 'quote_attached' | 'come_in' | 'contact_request';

export type RouteDecision = {
  lane: RouteLane;
  simpleClass: SimpleClass | null;
  reasons: string[];
};

const FEE_PATTERN = /\b(doc(?:umentation)?(?:\s+fee)?|dealer\s+fee|taxes?|title|registration|destination|freight|add-?ons?|etching|prep|ttl|fees?)\b/i;
const AMBIGUOUS_PATTERN = /\b(around|about|ballpark|roughly|maybe|plus fees|plus tax|\+ ?fees|\+ ?tax|\+ ?ttl|and fees|or so|somewhere|idk|not sure|depends|plus ttl)\b/i;
const CONFLICT_PATTERN = /\b(actually|correction|instead|on second thought|wait,|no,)\b/i;
const QUOTE_ATTACHED = /\b(?:quote|worksheet|pencil|buyer'?s? order|breakdown)\b[\s\S]{0,48}\b(?:attached|attachment|enclosed)\b|\b(?:attached|attachment|see attached|enclosed)\b[\s\S]{0,48}\b(?:quote|worksheet|pencil|buyer'?s? order|breakdown)\b|^quote attached[.!]?$/i;
const COME_IN = /\b(when can you come in|come on in|come in|stop by|swing by|visit (?:us|the (?:store|dealership)))\b/i;
const CONTACT_REQUEST = /\b(phone|cell|mobile|email|e-mail)\b/i;
const YEAR = /^(19|20)\d{2}$/;

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

export function moneyMentions(text: string): number[] {
  const found: number[] = [];
  const add = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 500_000) return;
    if (found.some((existing) => Math.abs(existing - value) < 0.5)) return;
    found.push(value);
  };

  for (const match of text.matchAll(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g)) {
    add(Number(match[1].replace(/,/g, '')) + (match[2] ? Number(`0.${match[2]}`) : 0));
  }
  for (const match of text.matchAll(/\b(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?\b/g)) {
    add(Number(match[1].replace(/,/g, '')));
  }
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(k|grand|racks?)\b/gi)) {
    add(Number(match[1]) * 1000);
  }
  for (const match of text.matchAll(/\b(\d+|a|one|two|three|four|five|six|seven|eight|nine)\s+hundos?\b/gi)) {
    const raw = match[1].toLowerCase();
    const count = NUMBER_WORDS[raw] ?? Number(raw);
    if (Number.isFinite(count)) add(count * 100);
  }
  for (const match of text.matchAll(/\b(\d{4,6})(?:\.(\d{1,2}))?\b/g)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 1), index);
    if (YEAR.test(match[1]) && !before.includes('$')) continue;
    add(Number(match[1]));
  }

  return found;
}

export function routeDealerMessage(message: string): RouteDecision {
  const text = message.trim();
  const amounts = moneyMentions(text);
  const reasons: string[] = [];
  const feeHeavy = FEE_PATTERN.test(text);
  const ambiguous = AMBIGUOUS_PATTERN.test(text);
  const conflicting = amounts.length >= 2 && (CONFLICT_PATTERN.test(text) || amounts.length >= 3);

  if (feeHeavy) reasons.push('fee_heavy');
  if (ambiguous) reasons.push('ambiguous');
  if (conflicting) reasons.push('conflicting');
  if (amounts.length > 0) reasons.push('amounts');

  if (feeHeavy || ambiguous || conflicting || amounts.length > 0) {
    return { lane: 'main', simpleClass: null, reasons };
  }

  if (detectSmsOptOut(text).optedOut) {
    return { lane: 'fast', simpleClass: 'opt_out', reasons: ['opt_out'] };
  }
  if (QUOTE_ATTACHED.test(text)) {
    return { lane: 'fast', simpleClass: 'quote_attached', reasons: ['quote_attached'] };
  }
  if (COME_IN.test(text)) {
    return { lane: 'fast', simpleClass: 'come_in', reasons: ['come_in'] };
  }
  if (CONTACT_REQUEST.test(text)) {
    return { lane: 'fast', simpleClass: 'contact_request', reasons: ['contact_request'] };
  }
  if (text.length <= 80) {
    return { lane: 'fast', simpleClass: null, reasons: ['short_clear'] };
  }
  return { lane: 'main', simpleClass: null, reasons: ['unclassified'] };
}

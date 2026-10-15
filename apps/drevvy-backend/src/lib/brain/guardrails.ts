/**
 * Brain guardrails: enforced in code before any queued action.
 * These are hard blocks, not prompt suggestions.
 *
 * Rules:
 * 1. No cold texts: SMS only if dealer texted first or opted in
 * 2. California calls NOT paused (spec clarification: CA calls are allowed)
 * 3. Never contest taxes, title, or registration AMOUNTS (doc/destination fees are discussable)
 * 4. Max 2 pushback rounds per deal per dealer
 * 5. Push back only when offer OTD > fair OTD + max($500, 1.5% of fair OTD)
 * 6. Never share shopper contact info (phone, email, last name)
 * 7. Present offer immediately when $750+ under fair
 * 8. Request itemization when price isn't itemized
 * 9. "Price first, then we're happy to set that up" for come-in/call-me requests
 * 10. Honest AI disclosure ("I'm Drevvy's AI, working for {first}")
 * 11. Escalate (block counter) when fair OTD is unknown
 * 12. Never use the phrase "automated assistant"
 */

import { PUSHBACK_THRESHOLD } from './config';

export const CALL_OPENER = "Hi, this is Drevvy calling for {first}. Quick heads-up, this call is recorded.";

export type GuardrailInput = {
  action: string | null;
  draft: string | null;
  dealerState?: string;
  channel: 'sms' | 'email' | 'call';
  hasOptedInToText: boolean;
  hasTextedBefore: boolean;
  fairOtd: number | null;
  currentOfferOtd: number | null;
  pushbackCount: number;
  shopperFirst: string;
};

export type GuardrailResult = {
  blocked: boolean;
  violations: string[];
  checks: {
    noColdTexts: boolean;
    noTaxContest: boolean;
    maxPushbacks: boolean;
    otdThreshold: boolean;
    noShopperContactInfo: boolean;
    noAutomatedAssistant: boolean;
    noNegotiateWord: boolean;
    fairOtdKnownForCounter: boolean;
  };
};

const MAX_PUSHBACK_ROUNDS = 2;
const PRESENT_IMMEDIATELY_THRESHOLD = 750;

const TAX_TITLE_REG_CONTEST_PATTERNS = [
  /\b(contest|dispute|challenge|reduce|lower|waive|remove|drop)\s+.{0,20}(tax|taxes|title\s*fee|registration\s*fee)/i,
  /\b(tax|taxes|title\s*fee|registration\s*fee).{0,20}(too\s+)?(high|much|excessive|unfair|wrong)/i,
  /\bshouldn'?t\s+(have\s+to\s+)?pay.{0,20}(tax|taxes|title|registration)/i,
  /\b(we\s+)?won'?t\s+pay.{0,20}(tax|taxes|title|registration)/i,
  /\bremove\s+the\s+(tax|title|registration)/i,
];

const SHOPPER_CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\blast\s*name\b/i,
  /\bsurname\b/i,
  /\bfamily\s*name\b/i,
];

const AUTOMATED_ASSISTANT_PATTERN = /\bautomated\s+assistant\b/i;
const NEGOTIATE_PATTERN = /\bnegotiat/i;

export function runGuardrails(input: GuardrailInput): GuardrailResult {
  const violations: string[] = [];
  const draft = input.draft ?? '';

  const noColdTexts = checkNoColdTexts(input);
  if (!noColdTexts) {
    violations.push('no_cold_texts');
  }

  const noTaxContest = checkNoTaxContest(draft, input.action);
  if (!noTaxContest) {
    violations.push('no_tax_contest');
  }

  const maxPushbacks = checkMaxPushbacks(input.action, input.pushbackCount);
  if (!maxPushbacks) {
    violations.push('max_pushbacks_exceeded');
  }

  const otdThreshold = checkOtdThreshold(input.action, input.fairOtd, input.currentOfferOtd);
  if (!otdThreshold) {
    violations.push('otd_below_threshold');
  }

  const noShopperContactInfo = checkNoShopperContactInfo(draft, input.shopperFirst);
  if (!noShopperContactInfo) {
    violations.push('shopper_contact_info_leaked');
  }

  const noAutomatedAssistant = checkNoAutomatedAssistant(draft);
  if (!noAutomatedAssistant) {
    violations.push('automated_assistant_phrase');
  }

  const noNegotiateWord = checkNoNegotiateWord(draft);
  if (!noNegotiateWord) {
    violations.push('negotiate_word_used');
  }

  const fairOtdKnownForCounter = checkFairOtdKnownForCounter(input.action, input.fairOtd);
  if (!fairOtdKnownForCounter) {
    violations.push('fair_otd_unknown_for_counter');
  }

  return {
    blocked: violations.length > 0,
    violations,
    checks: {
      noColdTexts,
      noTaxContest,
      maxPushbacks,
      otdThreshold,
      noShopperContactInfo,
      noAutomatedAssistant,
      noNegotiateWord,
      fairOtdKnownForCounter,
    },
  };
}

function checkNoColdTexts(input: GuardrailInput): boolean {
  if (input.channel !== 'sms') return true;
  return input.hasOptedInToText || input.hasTextedBefore;
}

function checkNoTaxContest(draft: string, action: string | null): boolean {
  if (!draft && !action) return true;
  const textToCheck = `${draft} ${action ?? ''}`;

  for (const pattern of TAX_TITLE_REG_CONTEST_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return false;
    }
  }

  return true;
}

function checkMaxPushbacks(action: string | null, pushbackCount: number): boolean {
  if (action !== 'counter') return true;
  return pushbackCount < MAX_PUSHBACK_ROUNDS;
}

export function checkOtdThreshold(
  action: string | null,
  fairOtd: number | null,
  currentOfferOtd: number | null,
): boolean {
  if (action !== 'counter') return true;
  if (currentOfferOtd === null) return true;
  if (fairOtd === null) return true;

  const absoluteThreshold = PUSHBACK_THRESHOLD.absoluteDollars;
  const percentThreshold = fairOtd * PUSHBACK_THRESHOLD.percentOfFair;
  const threshold = Math.max(absoluteThreshold, percentThreshold);

  const difference = currentOfferOtd - fairOtd;
  return difference >= threshold;
}

function checkNoAutomatedAssistant(draft: string): boolean {
  if (!draft) return true;
  return !AUTOMATED_ASSISTANT_PATTERN.test(draft);
}

function checkNoNegotiateWord(draft: string): boolean {
  if (!draft) return true;
  return !NEGOTIATE_PATTERN.test(draft);
}

function checkFairOtdKnownForCounter(action: string | null, fairOtd: number | null): boolean {
  if (action !== 'counter') return true;
  return fairOtd !== null;
}

function checkNoShopperContactInfo(draft: string, shopperFirst: string): boolean {
  if (!draft) return true;

  for (const pattern of SHOPPER_CONTACT_PATTERNS) {
    if (pattern.test(draft)) {
      return false;
    }
  }

  const firstNameLower = shopperFirst.toLowerCase();
  const draftLower = draft.toLowerCase();
  const words = draftLower.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === firstNameLower) {
      const nextWord = words[i + 1].replace(/[^a-z]/g, '');
      if (nextWord.length > 2 && !['the', 'and', 'for', 'has', 'was', 'will', 'can', 'would', 'could', 'should'].includes(nextWord)) {
        const possibleLastName = /^[A-Z][a-z]+$/.test(draft.split(/\s+/)[i + 1]?.replace(/[^A-Za-z]/g, '') ?? '');
        if (possibleLastName) {
          return false;
        }
      }
    }
  }

  return true;
}

export function computeOtdThreshold(fairOtd: number): number {
  const absoluteThreshold = PUSHBACK_THRESHOLD.absoluteDollars;
  const percentThreshold = fairOtd * PUSHBACK_THRESHOLD.percentOfFair;
  return Math.max(absoluteThreshold, percentThreshold);
}

export type PlaybookDecision =
  | { action: 'present_to_shopper'; reason: string }
  | { action: 'request_itemization'; reason: string }
  | { action: 'price_first_response'; reason: string }
  | { action: 'escalate_to_human'; reason: string }
  | { action: 'continue'; reason: string };

export function applyPlaybookRules(input: {
  fairOtd: number | null;
  currentOfferOtd: number | null;
  isItemized: boolean;
  dealerMessage: string;
  shopperFirst: string;
}): PlaybookDecision {
  if (input.fairOtd === null) {
    return { action: 'escalate_to_human', reason: 'Fair OTD is unknown; cannot evaluate offer' };
  }

  if (input.currentOfferOtd !== null) {
    const underFair = input.fairOtd - input.currentOfferOtd;
    if (underFair >= PRESENT_IMMEDIATELY_THRESHOLD) {
      return {
        action: 'present_to_shopper',
        reason: `Offer is $${underFair.toLocaleString()} under fair OTD; present immediately`,
      };
    }
  }

  if (input.currentOfferOtd !== null && !input.isItemized) {
    return { action: 'request_itemization', reason: 'Price received but not itemized' };
  }

  const lowerMessage = input.dealerMessage.toLowerCase();
  const comeInPatterns = [
    /come\s*(on\s+)?in/i,
    /stop\s+by/i,
    /visit\s+(us|the\s+dealership)/i,
    /come\s+to\s+(the\s+)?(store|dealership)/i,
  ];
  const callMePatterns = [
    /call\s+(me|us)/i,
    /give\s+(me|us)\s+a\s+call/i,
    /phone\s+number/i,
    /can\s+i\s+(get|have)\s+(your|the\s+buyer'?s?)\s+(number|phone|contact)/i,
    /buyer'?s?\s+(phone|number|contact)/i,
    /contact\s+(info|information|details)/i,
  ];

  for (const pattern of comeInPatterns) {
    if (pattern.test(lowerMessage)) {
      return { action: 'price_first_response', reason: 'Dealer requested buyer come in' };
    }
  }

  for (const pattern of callMePatterns) {
    if (pattern.test(lowerMessage)) {
      return { action: 'price_first_response', reason: 'Dealer requested buyer contact info' };
    }
  }

  return { action: 'continue', reason: 'No special playbook rule triggered' };
}

export function getAiDisclosure(shopperFirst: string): string {
  return `I'm Drevvy's AI, working for ${shopperFirst}.`;
}

export function getPriceFirstResponse(): string {
  return "Price first, then we're happy to set that up.";
}

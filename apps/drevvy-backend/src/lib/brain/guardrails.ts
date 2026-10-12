/**
 * Brain guardrails: enforced in code before any queued action.
 * These are hard blocks, not prompt suggestions.
 *
 * Rules:
 * 1. No cold texts: SMS only if dealer texted first or opted in
 * 2. California calls NOT paused (spec clarification: CA calls are allowed)
 * 3. Never contest taxes, title, or registration fees
 * 4. Max 2 pushback rounds per deal per dealer
 * 5. Push back only when offer OTD > fair OTD + max($500, 1.5% of fair OTD)
 * 6. Never share shopper contact info (phone, email, last name)
 */

import { PUSHBACK_THRESHOLD } from './config';

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
  };
};

const MAX_PUSHBACK_ROUNDS = 2;

const TAX_TITLE_REG_PATTERNS = [
  /\b(tax|taxes|taxation)\b/i,
  /\btitle\s*(fee|fees|charge|charges|cost|costs)?\b/i,
  /\bregistration\s*(fee|fees|charge|charges|cost|costs)?\b/i,
  /\bdoc\s*(fee|fees)\b/i,
  /\bdestination\s*(fee|fees|charge|charges)?\b/i,
  /\b(contest|dispute|challenge|negotiate|reduce|lower|waive|remove)\s*(the\s+)?(tax|title|registration|doc|destination)/i,
  /\b(tax|title|registration|doc|destination)\s*(is|are|seems?)?\s*(too\s+)?(high|much|excessive)/i,
];

const SHOPPER_CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\blast\s*name\b/i,
  /\bsurname\b/i,
  /\bfamily\s*name\b/i,
];

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

  return {
    blocked: violations.length > 0,
    violations,
    checks: {
      noColdTexts,
      noTaxContest,
      maxPushbacks,
      otdThreshold,
      noShopperContactInfo,
    },
  };
}

function checkNoColdTexts(input: GuardrailInput): boolean {
  if (input.channel !== 'sms') return true;
  return input.hasOptedInToText || input.hasTextedBefore;
}

function checkNoTaxContest(draft: string, action: string | null): boolean {
  if (!draft && !action) return true;
  const textToCheck = `${draft} ${action ?? ''}`.toLowerCase();

  for (const pattern of TAX_TITLE_REG_PATTERNS) {
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
  if (fairOtd === null || currentOfferOtd === null) return true;

  const absoluteThreshold = PUSHBACK_THRESHOLD.absoluteDollars;
  const percentThreshold = fairOtd * PUSHBACK_THRESHOLD.percentOfFair;

  const threshold = PUSHBACK_THRESHOLD.mode === 'greater'
    ? Math.max(absoluteThreshold, percentThreshold)
    : Math.min(absoluteThreshold, percentThreshold);

  const difference = currentOfferOtd - fairOtd;
  return difference >= threshold;
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

  return PUSHBACK_THRESHOLD.mode === 'greater'
    ? Math.max(absoluteThreshold, percentThreshold)
    : Math.min(absoluteThreshold, percentThreshold);
}

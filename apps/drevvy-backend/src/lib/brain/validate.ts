/**
 * Code checks a model proposal against the playbook, guardrails, quote math,
 * and the shopper mandate. At most one outbound reply is planned, and shadow
 * mode plans none.
 */

import { deniesBeingAi } from '../agent-voice';
import { detectSmsOptOut } from '../sms/opt-out';
import {
  getAiDisclosure,
  getPriceFirstResponse,
  runGuardrails,
  type GuardrailResult,
  type PlaybookDecision,
} from './guardrails';
import type { DealProposal, ProposedAction } from './proposal';
import type { OtdComputation } from './quote';

export type ShopperMandate = {
  approved: boolean;
  maxOtd: number | null;
  dealBreakers?: string[];
};

export type OutboundSideEffect = {
  kind: 'dealer_reply';
  channel: 'sms' | 'email' | 'call';
  draft: string;
};

export type ValidatedReply = {
  proposedAction: ProposedAction;
  decision: 'respond' | 'escalate' | 'skip';
  action: string | null;
  draft: string | null;
  reasoning: string;
  guardrailResult: GuardrailResult;
  sideEffect: OutboundSideEffect | null;
};

export const ITEMIZATION_DRAFT = 'Could you send an itemized out-the-door quote? I need the vehicle price, doc fee, tax, title, registration, and any add-ons, each on its own line.';

export const FEE_CLARIFICATION_DRAFT = 'Thanks. Those figures do not add up to one out-the-door total. Could you resend the itemized breakdown, with vehicle price, doc fee, tax, title, registration, and any add-ons listed separately?';

const NEGOTIATE_PATTERN = /\bnegotiat/i;
const PRICE_PUSH_PATTERN = /\b(lower (?:the |your )?price|reduce (?:the |your )?price|too high|come down|better (?:number|price)|less than)\b/i;
const FEE_FIELDS = ['doc_fee', 'tax', 'title_fee', 'registration_fee', 'destination_fee', 'addons'] as const;

export function validateProposal(input: {
  proposal: DealProposal;
  otd: OtdComputation;
  playbook: PlaybookDecision;
  dealerMessage: string;
  channel: 'sms' | 'email' | 'call';
  dealerState?: string;
  hasOptedInToText: boolean;
  hasTextedBefore: boolean;
  fairOtd: number | null;
  currentOfferOtd: number | null;
  pushbackCount: number;
  shopperFirst: string;
  mandate: ShopperMandate | null;
  shadowMode: boolean;
}): ValidatedReply {
  let action = input.proposal.proposed_action;
  let draft = applyFirstName(input.proposal.draft, input.shopperFirst);
  const reasons = [input.proposal.reasoning];
  const optedOut = detectSmsOptOut(input.dealerMessage).optedOut;

  if (optedOut) {
    action = 'wait';
    draft = null;
    reasons.push('Dealer opted out; no reply.');
  } else if (input.playbook.action === 'honest_ai_disclosure') {
    action = 'send_reply';
    draft = getAiDisclosure(input.shopperFirst);
    reasons.push(input.playbook.reason);
  } else if (input.playbook.action === 'escalate_to_human') {
    action = 'escalate';
    draft = null;
    reasons.push(input.playbook.reason);
  } else if (input.playbook.action === 'present_to_shopper') {
    action = 'wait';
    draft = null;
    reasons.push(input.playbook.reason);
  } else if (input.playbook.action === 'price_first_response') {
    action = 'send_reply';
    draft = getPriceFirstResponse();
    reasons.push(input.playbook.reason);
  } else if (input.playbook.action === 'request_itemization' && !input.otd.complete) {
    action = 'ask_for_itemization';
    draft = safeDraft(draft, ITEMIZATION_DRAFT);
    reasons.push(input.playbook.reason);
  } else {
    const adjusted = actionForQuote(action, input.otd);
    if (adjusted !== action) {
      draft = adjusted === 'request_fee_clarification' ? FEE_CLARIFICATION_DRAFT : ITEMIZATION_DRAFT;
      action = adjusted;
      reasons.push('Code adjusted the action after checking the quote.');
    }
  }

  const mandateReason = mandateBlockReason(input.mandate, action, input.otd, input.dealerMessage);
  if (mandateReason) {
    action = 'escalate';
    draft = null;
    reasons.push(mandateReason);
  }

  const presentToShopper = !optedOut && input.playbook.action === 'present_to_shopper' && !mandateReason;
  const legacy = presentToShopper ? 'accept' : legacyAction(action, draft);
  const guardrailResult = runGuardrails({
    action: legacy,
    draft,
    dealerState: input.dealerState,
    dealerMessage: input.dealerMessage,
    channel: input.channel,
    hasOptedInToText: input.hasOptedInToText,
    hasTextedBefore: input.hasTextedBefore,
    fairOtd: input.fairOtd,
    currentOfferOtd: input.currentOfferOtd,
    pushbackCount: input.pushbackCount,
    shopperFirst: input.shopperFirst,
  });

  const blocked = guardrailResult.blocked;
  const finalDraft = blocked || presentToShopper ? null : draft;
  const decision = blocked
    ? 'skip'
    : presentToShopper
      ? 'respond'
      : decisionFor(action);

  if (blocked) reasons.push(`Blocked by guardrails: ${guardrailResult.violations.join(', ')}`);

  return {
    proposedAction: blocked ? action : action,
    decision,
    action: blocked ? null : legacy,
    draft: finalDraft,
    reasoning: reasons.filter(Boolean).join(' '),
    guardrailResult,
    sideEffect: planSideEffect({
      shadowMode: input.shadowMode,
      decision,
      draft: finalDraft,
      channel: input.channel,
    }),
  };
}

export function planSideEffect(input: {
  shadowMode: boolean;
  decision: 'respond' | 'escalate' | 'skip';
  draft: string | null;
  channel: 'sms' | 'email' | 'call';
}): OutboundSideEffect | null {
  if (input.shadowMode) return null;
  if (input.decision !== 'respond' || !input.draft) return null;
  return { kind: 'dealer_reply', channel: input.channel, draft: input.draft };
}

export function actionForQuote(action: ProposedAction, otd: OtdComputation): ProposedAction {
  if (action === 'wait' || action === 'escalate') return action;
  const inconsistent = otd.flags.some((flag) => flag.code === 'inconsistent_total' || flag.code === 'invalid_amount');
  const missing = otd.flags.some((flag) => flag.code === 'missing_fee');
  if (inconsistent) return 'request_fee_clarification';
  if (missing) return anyKnownFee(otd) ? 'request_fee_clarification' : 'ask_for_itemization';
  return action;
}

function anyKnownFee(otd: OtdComputation): boolean {
  return otd.components.some((component) =>
    (FEE_FIELDS as readonly string[]).includes(component.field) && component.amount != null,
  );
}

function decisionFor(action: ProposedAction): 'respond' | 'escalate' | 'skip' {
  if (action === 'escalate') return 'escalate';
  if (action === 'wait') return 'skip';
  return 'respond';
}

function legacyAction(action: ProposedAction, draft: string | null): string | null {
  if (action === 'wait' || action === 'escalate') return null;
  if (action === 'send_reply' && draft && PRICE_PUSH_PATTERN.test(draft)) return 'counter';
  return 'clarify';
}

function safeDraft(draft: string | null, fallback: string): string {
  if (!draft || NEGOTIATE_PATTERN.test(draft) || deniesBeingAi(draft)) return fallback;
  return draft;
}

function applyFirstName(draft: string | null, shopperFirst: string): string | null {
  if (!draft) return null;
  return draft.split('{first}').join(shopperFirst.trim());
}

function mandateBlockReason(
  mandate: ShopperMandate | null,
  action: ProposedAction,
  otd: OtdComputation,
  dealerMessage: string,
): string | null {
  if (!mandate) return null;
  if (!mandate.approved && action !== 'wait' && action !== 'escalate') {
    return 'Shopper mandate is not approved, so nothing goes to the dealer.';
  }
  const total = otd.complete ? otd.computedOtd : otd.statedOtd;
  if (
    mandate.approved
    && mandate.maxOtd != null
    && total != null
    && total > mandate.maxOtd
    && action === 'send_reply'
  ) {
    return 'The quote is above the shopper max out-the-door.';
  }
  const breaker = (mandate.dealBreakers ?? []).find((item) => {
    const needle = item.trim().toLowerCase();
    return needle.length > 0 && dealerMessage.toLowerCase().includes(needle);
  });
  if (breaker && action === 'send_reply') {
    return `The reply hits a shopper deal-breaker (${breaker.trim()}).`;
  }
  return null;
}

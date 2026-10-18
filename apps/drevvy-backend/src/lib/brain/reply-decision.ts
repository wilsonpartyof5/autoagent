/**
 * Per-dealer-reply loop, in shadow mode unless BRAIN_SHADOW_MODE=false.
 *
 * Load state, ask a model for one proposed action, check it in code, perform
 * at most one outbound side effect, save, and exit. This does not use the
 * Agents API. Shadow mode logs the decision and sends nothing.
 */

import type OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { BRAIN_CONFIG, SHADOW_MODE } from './config';
import { estimateCost } from './cost';
import {
  applyPlaybookRules,
  getAiDisclosure,
  type GuardrailResult,
  type PlaybookDecision,
} from './guardrails';
import { buildModelUserContent } from './model-input';
import { logModelAnswer, requestDealProposal } from './model-request';
import type { DealProposal } from './proposal';
import { computeOtd, emptyQuote, type ExtractedQuote, type OtdComputation } from './quote';
import { insertBrainRun, updateBrainRun, getApprovedLessons } from './repository';
import { routeDealerMessage } from './routing';
import {
  validateProposal,
  type OutboundSideEffect,
  type ShopperMandate,
} from './validate';

export type ReplyDecisionInput = {
  dealId: string;
  dealerId: string;
  dealerState?: string;
  channel: 'sms' | 'email' | 'call';
  dealerMessage: string;
  messageRef?: string | null;
  dealContext: {
    shopperFirst: string;
    shopperPhone?: string | null;
    shopperEmail?: string | null;
    shopperLast?: string | null;
    vehicle: string;
    fairOtd: number | null;
    currentOfferOtd: number | null;
    pushbackCount: number;
    hasOptedInToText: boolean;
    hasTextedBefore: boolean;
    isItemized: boolean;
    mandate?: ShopperMandate | null;
  };
};

export type ReplyDecisionResult = {
  runId: string;
  decision: 'respond' | 'escalate' | 'skip';
  action: string | null;
  proposedAction: DealProposal['proposed_action'];
  draft: string | null;
  quote: ExtractedQuote;
  otd: OtdComputation;
  guardrailResult: GuardrailResult;
  playbookDecision: PlaybookDecision | null;
  aiDisclosure: string;
  shadowMode: boolean;
  reasoning: string;
  model: string;
  usedFallback: boolean;
  sideEffect: OutboundSideEffect | null;
};

export const REPLY_DECISION_PROMPT = `You are Drevvy, working for a shopper to get a clear out-the-door price on a car. Read the dealer message and propose one next action.

RULES (enforced by code, not suggestions):
- Open short and friendly. The first line, when you introduce yourself, is: "Hi, this is Drevvy, working for {first}."
- Do not lead with "I'm an AI", "I'm a bot", or "I'm Drevvy's AI".
- If the dealer sincerely asks whether this is a bot, AI, or a person, answer truthfully with exactly: "I'm Drevvy's AI, working for {first}."
- Never deny being an AI. Never claim to be a human.
- Never contest taxes, title, or registration fees.
- Never share shopper contact info (phone, email, last name). You will not be given those details. Do not ask the shopper to hand them over, and do not invent them.
- Never use the word "negotiate".
- Maximum 2 pushback rounds per deal.
- If the dealer asks the buyer to come in, call, or share contact info, the reply is "Price first, then we're happy to set that up."
- If the dealer opts out, propose wait and leave the draft null.

Propose exactly one action:
- ask_for_itemization: a price is missing its breakdown
- request_fee_clarification: a fee or total conflicts, or a stated number does not match the lines
- send_reply: send the draft
- wait: do not reply
- escalate: a person should take this

Extract quote fields only when the message states them. Each amount needs a source_snippet copied from the message and message_ref from the prompt. Use null for the whole field when it is unknown. Do not guess. Do not compute an out-the-door total; code adds the lines and checks them. dealer_stated_otd is only the total the dealer themselves stated.

Return only the structured proposal.`;

export async function runReplyDecision(
  supabase: SupabaseClient,
  openai: OpenAI,
  input: ReplyDecisionInput,
): Promise<ReplyDecisionResult> {
  const runResult = await insertBrainRun(supabase, {
    job: 'reply_decision',
    model: BRAIN_CONFIG.model,
    prompt_version: BRAIN_CONFIG.promptVersion,
    trigger_ref: input.dealId,
    status: 'running',
    input_tokens: null,
    output_tokens: null,
    cost_usd: null,
    tool_calls: [],
    output: null,
    guardrail_hits: null,
    error: null,
    finished_at: null,
  });

  if ('error' in runResult) {
    throw new Error(`Failed to create brain run: ${runResult.error}`);
  }

  const runId = runResult.id;
  const aiDisclosure = getAiDisclosure(input.dealContext.shopperFirst);

  try {
    const playbookDecision = applyPlaybookRules({
      fairOtd: input.dealContext.fairOtd,
      currentOfferOtd: input.dealContext.currentOfferOtd,
      isItemized: input.dealContext.isItemized,
      dealerMessage: input.dealerMessage,
      shopperFirst: input.dealContext.shopperFirst,
    });

    const proposed = await loadProposal(supabase, openai, input, playbookDecision, runId);
    const otd = computeOtd(proposed.proposal.quote);
    const validated = validateProposal({
      proposal: proposed.proposal,
      otd,
      playbook: playbookDecision,
      dealerMessage: input.dealerMessage,
      channel: input.channel,
      dealerState: input.dealerState,
      hasOptedInToText: input.dealContext.hasOptedInToText,
      hasTextedBefore: input.dealContext.hasTextedBefore,
      fairOtd: input.dealContext.fairOtd,
      currentOfferOtd: input.dealContext.currentOfferOtd,
      pushbackCount: input.dealContext.pushbackCount,
      shopperFirst: input.dealContext.shopperFirst,
      mandate: input.dealContext.mandate ?? null,
      shadowMode: SHADOW_MODE,
    });

    if (SHADOW_MODE && validated.sideEffect) {
      throw new Error('Shadow mode tried to send a dealer reply.');
    }
    const sideEffect = validated.sideEffect;

    const result: ReplyDecisionResult = {
      runId,
      decision: validated.decision,
      action: validated.action,
      proposedAction: validated.proposedAction,
      draft: validated.draft,
      quote: proposed.proposal.quote,
      otd,
      guardrailResult: validated.guardrailResult,
      playbookDecision,
      aiDisclosure,
      shadowMode: SHADOW_MODE,
      reasoning: validated.reasoning,
      model: proposed.model,
      usedFallback: proposed.usedFallback,
      sideEffect,
    };

    await updateBrainRun(supabase, runId, {
      model: proposed.model,
      status: validated.guardrailResult.blocked ? 'blocked_by_guardrail' : 'ok',
      input_tokens: proposed.usage.inputTokens,
      output_tokens: proposed.usage.outputTokens,
      cost_usd: estimateCost(
        proposed.usage.inputTokens,
        proposed.usage.outputTokens,
        proposed.model === 'rules' ? BRAIN_CONFIG.model : proposed.model,
        proposed.usage.cachedTokens,
      ),
      output: result,
      guardrail_hits: validated.guardrailResult.violations.length > 0
        ? validated.guardrailResult.violations
        : null,
      finished_at: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateBrainRun(supabase, runId, {
      status: 'error',
      error: errorMessage,
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}

async function loadProposal(
  supabase: SupabaseClient,
  openai: OpenAI,
  input: ReplyDecisionInput,
  playbook: PlaybookDecision,
  runId: string,
): Promise<{
  proposal: DealProposal;
  model: string;
  usedFallback: boolean;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
}> {
  if (playbook.action === 'honest_ai_disclosure') {
    logModelAnswer({ model: 'rules', role: 'rules', usedFallback: false, lane: 'rules', runId });
    return {
      proposal: {
        proposed_action: 'send_reply',
        draft: getAiDisclosure(input.dealContext.shopperFirst),
        reasoning: playbook.reason,
        quote: emptyQuote(),
      },
      model: 'rules',
      usedFallback: false,
      usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
    };
  }

  const lessons = await getApprovedLessons(supabase, { dealer_type: undefined });
  const route = routeDealerMessage(input.dealerMessage);
  const called = await requestDealProposal({
    create: (params) => openai.responses.create(params),
    model: route.lane === 'fast' ? BRAIN_CONFIG.fastModel : BRAIN_CONFIG.model,
    fallbackModel: BRAIN_CONFIG.fallbackModel,
    role: route.lane,
    instructions: REPLY_DECISION_PROMPT,
    userContent: buildModelUserContent(input, lessons.map((lesson) => ({ lesson: lesson.lesson })), route),
    runId,
  });
  return called;
}

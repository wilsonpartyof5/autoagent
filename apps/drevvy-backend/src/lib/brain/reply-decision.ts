/**
 * Per-dealer-reply decision pass in SHADOW MODE.
 * Logs decisions but sends nothing until DW approves.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { BRAIN_CONFIG, SHADOW_MODE } from './config';
import { type GuardrailResult, runGuardrails } from './guardrails';
import { insertBrainRun, updateBrainRun, getApprovedLessons } from './repository';

export type ReplyDecisionInput = {
  dealId: string;
  dealerId: string;
  dealerState?: string;
  channel: 'sms' | 'email' | 'call';
  dealerMessage: string;
  dealContext: {
    shopperFirst: string;
    vehicle: string;
    fairOtd: number | null;
    currentOfferOtd: number | null;
    pushbackCount: number;
    hasOptedInToText: boolean;
    hasTextedBefore: boolean;
  };
};

export type ReplyDecisionResult = {
  runId: string;
  decision: 'respond' | 'escalate' | 'skip';
  action: string | null;
  draft: string | null;
  guardrailResult: GuardrailResult;
  shadowMode: boolean;
  reasoning: string;
};

const REPLY_DECISION_PROMPT = `You are Drevvy's AI assistant, helping shoppers get the best price on a car. Analyze the dealer's message and decide on the best response.

RULES (enforced by code, not suggestions):
- Never contest taxes, title, or registration fees
- Never share shopper contact info (phone, email, last name)
- Maximum 2 pushback rounds per deal
- Push back only when offer exceeds fair OTD by threshold
- Text only dealers who have opted in or texted first
- If dealer asks buyer to "come in" or requests their contact info, respond "Price first, then we're happy to set that up"
- Always identify yourself honestly: "I'm Drevvy's AI, working for {first}"
- Request itemized pricing if price is not broken down

Given the dealer message and deal context, decide:
1. Should we respond, escalate to human, or skip?
2. If responding, what action and draft message?

Return JSON:
{
  "decision": "respond" | "escalate" | "skip",
  "action": "accept" | "counter" | "clarify" | "decline" | null,
  "draft": "message to dealer" | null,
  "reasoning": "explanation of decision"
}`;

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

  try {
    const lessons = await getApprovedLessons(supabase, {
      dealer_type: undefined,
    });

    const lessonsContext = lessons.length > 0
      ? `\n\nApproved lessons to consider:\n${lessons.map((l) => `- ${l.lesson}`).join('\n')}`
      : '';

    const userMessage = `Deal context:
- Shopper: ${input.dealContext.shopperFirst}
- Vehicle: ${input.dealContext.vehicle}
- Fair OTD: ${input.dealContext.fairOtd ? `$${input.dealContext.fairOtd.toLocaleString()}` : 'unknown'}
- Current offer: ${input.dealContext.currentOfferOtd ? `$${input.dealContext.currentOfferOtd.toLocaleString()}` : 'none'}
- Pushback rounds so far: ${input.dealContext.pushbackCount}
- Opted in to text: ${input.dealContext.hasOptedInToText}
- Has texted before: ${input.dealContext.hasTextedBefore}
- Dealer state: ${input.dealerState ?? 'unknown'}
${lessonsContext}

Dealer message (via ${input.channel}):
${input.dealerMessage}`;

    const response = await openai.chat.completions.create({
      model: BRAIN_CONFIG.model,
      messages: [
        { role: 'system', content: REPLY_DECISION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(content) as {
      decision?: string;
      action?: string;
      draft?: string;
      reasoning?: string;
    };

    const decision = (['respond', 'escalate', 'skip'] as const).includes(parsed.decision as 'respond')
      ? (parsed.decision as 'respond' | 'escalate' | 'skip')
      : 'skip';

    const guardrailResult = runGuardrails({
      action: parsed.action ?? null,
      draft: parsed.draft ?? null,
      dealerState: input.dealerState,
      channel: input.channel,
      hasOptedInToText: input.dealContext.hasOptedInToText,
      hasTextedBefore: input.dealContext.hasTextedBefore,
      fairOtd: input.dealContext.fairOtd,
      currentOfferOtd: input.dealContext.currentOfferOtd,
      pushbackCount: input.dealContext.pushbackCount,
      shopperFirst: input.dealContext.shopperFirst,
    });

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    const result: ReplyDecisionResult = {
      runId,
      decision: guardrailResult.blocked ? 'skip' : decision,
      action: guardrailResult.blocked ? null : (parsed.action ?? null),
      draft: guardrailResult.blocked ? null : (parsed.draft ?? null),
      guardrailResult,
      shadowMode: SHADOW_MODE,
      reasoning: guardrailResult.blocked
        ? `Blocked by guardrails: ${guardrailResult.violations.join(', ')}`
        : (parsed.reasoning ?? 'No reasoning provided'),
    };

    await updateBrainRun(supabase, runId, {
      status: guardrailResult.blocked ? 'blocked_by_guardrail' : 'ok',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens, BRAIN_CONFIG.model),
      output: result,
      guardrail_hits: guardrailResult.violations.length > 0 ? guardrailResult.violations : null,
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

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const rates: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
  };
  const rate = rates[model] ?? rates['gpt-4o'];
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}

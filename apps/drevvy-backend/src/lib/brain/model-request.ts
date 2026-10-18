/**
 * Responses API calls for the deal brain. Newer models reject max_tokens and,
 * when they are reasoning models, temperature. One fallback retry, then stop.
 */

import type OpenAI from 'openai';

import { BRAIN_CONFIG, type ReasoningEffort } from './config';
import { parseProposal, PROPOSAL_JSON_SCHEMA, type DealProposal } from './proposal';

export type ModelRole = 'main' | 'fast' | 'fallback';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export type ProposalCallResult = {
  proposal: DealProposal;
  model: string;
  usedFallback: boolean;
  usage: TokenUsage;
};

export function modelSupportsTemperature(model: string): boolean {
  const name = model.trim().toLowerCase();
  if (name.startsWith('gpt-6') || name.startsWith('gpt-5') || name.startsWith('grok-') || /^o\d/.test(name)) {
    return false;
  }
  return true;
}

export function reasoningEffortFor(model: string, role: ModelRole): ReasoningEffort | null {
  if (role !== 'main') return null;
  if (modelSupportsTemperature(model)) return null;
  return BRAIN_CONFIG.reasoningEffort;
}

export function modelSampling(model: string, role: ModelRole): {
  reasoning?: { effort: ReasoningEffort };
  temperature?: number;
} {
  const sampling: { reasoning?: { effort: ReasoningEffort }; temperature?: number } = {};
  const effort = reasoningEffortFor(model, role);
  if (effort) sampling.reasoning = { effort };
  if (modelSupportsTemperature(model)) sampling.temperature = 0.2;
  return sampling;
}

export function buildProposalResponseParams(input: {
  model: string;
  role: ModelRole;
  instructions: string;
  userContent: string;
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: input.model,
    instructions: input.instructions,
    input: input.userContent,
    max_output_tokens: input.role === 'fast' ? 800 : 1600,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'deal_reply_proposal',
        strict: true,
        schema: PROPOSAL_JSON_SCHEMA,
      },
    },
  };
  const effort = reasoningEffortFor(input.model, input.role);
  if (effort) params.reasoning = { effort };
  if (modelSupportsTemperature(input.model)) params.temperature = 0.2;
  return params;
}

export function logModelAnswer(entry: {
  model: string;
  role: ModelRole | 'rules';
  usedFallback: boolean;
  lane: 'main' | 'fast' | 'rules';
  runId?: string;
}): void {
  console.info(JSON.stringify({ event: 'brain_model_answered', ...entry }));
}

export async function requestDealProposal(options: {
  create: (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => Promise<OpenAI.Responses.Response>;
  model: string;
  fallbackModel: string;
  role: 'main' | 'fast';
  instructions: string;
  userContent: string;
  runId?: string;
}): Promise<ProposalCallResult> {
  const attempts: Array<{ model: string; role: ModelRole }> = [
    { model: options.model, role: options.role },
    { model: options.fallbackModel, role: 'fallback' },
  ];
  let lastError: unknown;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      const params = buildProposalResponseParams({
        model: attempt.model,
        role: attempt.role,
        instructions: options.instructions,
        userContent: options.userContent,
      });
      const response = await options.create(params);
      if (response.error) {
        throw new Error(response.error.message || 'model response error');
      }
      const proposal = parseProposal(response.output_text ?? '');
      const usedFallback = index > 0;
      logModelAnswer({
        model: attempt.model,
        role: attempt.role,
        usedFallback,
        lane: options.role,
        runId: options.runId,
      });
      return {
        proposal,
        model: attempt.model,
        usedFallback,
        usage: usageFrom(response),
      };
    } catch (error) {
      lastError = error;
      if (index === attempts.length - 1) break;
      console.info(JSON.stringify({
        event: 'brain_model_retry',
        failedModel: attempt.model,
        fallbackModel: attempts[index + 1].model,
        runId: options.runId,
        reason: error instanceof Error ? error.message : 'unknown',
      }));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('model proposal failed');
}

function usageFrom(response: OpenAI.Responses.Response): TokenUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
  };
}

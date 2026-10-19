/**
 * Runs the labeled dealer replies through gpt-6-astra, gpt-6.1-sol, and
 * grok-4.7 (xAI's OpenAI-compatible base URL). Same cases, same proposal
 * schema. Prints fee accuracy, policy violations, valid proposals, latency,
 * and cost.
 *
 *   npm run eval:brain
 *
 * Requires OPENAI_API_KEY. Grok also needs XAI_API_KEY. A missing key skips
 * that model. This script is not part of the unit tests.
 */

import OpenAI from 'openai';

import {
  BRAIN_CONFIG,
  DEFAULT_OPENAI_FALLBACK_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_XAI_BASE_URL,
  DEFAULT_XAI_MODEL,
} from '../config';
import { estimateCost } from '../cost';
import { buildModelUserContent } from '../model-input';
import { buildProposalResponseParams, type ModelRole } from '../model-request';
import { parseProposal } from '../proposal';
import { REPLY_DECISION_PROMPT } from '../reply-decision';
import { routeDealerMessage } from '../routing';
import { EVAL_CASES } from './cases';
import { formatReport, scoreProposal, summarizeScores, type ModelReport } from './score';

export type EvalTarget = {
  label: string;
  model: string;
  apiKey: string | undefined;
  baseURL?: string;
  role: ModelRole;
};

export function evalTargetsFromEnv(env: Record<string, string | undefined> = process.env): EvalTarget[] {
  return [
    {
      label: 'gpt-6-astra',
      model: env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
      role: 'main',
    },
    {
      label: 'gpt-6.1-sol',
      model: env.OPENAI_FALLBACK_MODEL ?? DEFAULT_OPENAI_FALLBACK_MODEL,
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
      role: 'fallback',
    },
    {
      label: 'grok-4.7',
      model: env.XAI_MODEL ?? DEFAULT_XAI_MODEL,
      apiKey: env.XAI_API_KEY,
      baseURL: env.XAI_BASE_URL ?? DEFAULT_XAI_BASE_URL,
      role: 'fallback',
    },
  ];
}

export async function runEval(env: Record<string, string | undefined> = process.env): Promise<ModelReport[]> {
  const reports: ModelReport[] = [];
  for (const target of evalTargetsFromEnv(env)) {
    if (!target.apiKey) {
      reports.push(summarizeScores(target.label, [], `missing ${target.label === 'grok-4.7' ? 'XAI_API_KEY' : 'OPENAI_API_KEY'}`));
      continue;
    }
    const client = new OpenAI({
      apiKey: target.apiKey,
      ...(target.baseURL ? { baseURL: target.baseURL } : {}),
    });
    const scores = [];
    for (const testCase of EVAL_CASES) {
      const route = routeDealerMessage(testCase.message);
      const userContent = buildModelUserContent({
        channel: 'sms',
        dealerState: 'TX',
        dealerMessage: testCase.message,
        messageRef: 'dealer_message',
        dealContext: {
          shopperFirst: 'Maya',
          vehicle: '2022 Toyota RAV4 XLE',
          fairOtd: 32000,
          currentOfferOtd: null,
          pushbackCount: 0,
          isItemized: false,
        },
      }, [], route);
      const started = Date.now();
      try {
        const params = buildProposalResponseParams({
          model: target.model,
          role: target.role,
          instructions: REPLY_DECISION_PROMPT,
          userContent,
        });
        const response = await client.responses.create(params);
        const latencyMs = Date.now() - started;
        if (response.error) throw new Error(response.error.message || 'model response error');
        const proposal = parseProposal(response.output_text ?? '');
        const usage = response.usage;
        const costUsd = estimateCost(
          usage?.input_tokens ?? 0,
          usage?.output_tokens ?? 0,
          target.model,
          usage?.input_tokens_details?.cached_tokens ?? 0,
        );
        scores.push(scoreProposal(testCase, proposal, { latencyMs, costUsd }));
      } catch (error) {
        const latencyMs = Date.now() - started;
        console.info(JSON.stringify({
          event: 'brain_eval_case_failed',
          model: target.model,
          caseId: testCase.id,
          reason: error instanceof Error ? error.message : 'unknown',
        }));
        scores.push(scoreProposal(testCase, null, { latencyMs, costUsd: 0 }));
      }
    }
    reports.push(summarizeScores(target.label, scores));
  }
  return reports;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === new URL(`file://${process.argv[1]}`).href
    || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
  : false;

if (invokedDirectly) {
  runEval().then((reports) => {
    console.log(formatReport(reports));
    console.log(JSON.stringify({ promptVersion: BRAIN_CONFIG.promptVersion, reports }, null, 2));
    if (reports.every((report) => report.cases === 0)) process.exitCode = 1;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

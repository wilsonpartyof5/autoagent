/**
 * Daily analyst digest: what's working, bottlenecks, objections, proposed lessons.
 * Runs daily at 7:00 ET and writes to brain_runs.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { BRAIN_CONFIG } from './config';
import { TOOL_DEFINITIONS, executeTool, type BrainToolCall } from './tools';
import { insertBrainRun, updateBrainRun } from './repository';

export type DigestResult = {
  runId: string;
  working: string[];
  notWorking: string[];
  bottlenecks: string[];
  objections: string[];
  proposedLessons: Array<{ lesson: string; confidence: number }>;
  nextSteps: string[];
  tokens: { input: number; output: number };
  cost: number;
};

const DAILY_DIGEST_PROMPT = `You are a Drevvy analyst reviewing the dealer outreach system. Generate a daily digest analyzing:

1. What's working: Which touchpoints, variants, and channels have the best reply rates?
2. What's not working: Which have high failure rates, high opt-outs, or low engagement?
3. Bottlenecks: Where are deals stalling? What objections are common?
4. Lessons: What patterns have you identified that should inform future outreach?

Use the available tools to gather data. Be specific with numbers and percentages.
Focus on actionable insights, not just observations.

Return a JSON object with:
{
  "working": ["string array of what's working"],
  "notWorking": ["string array of what's not working"],
  "bottlenecks": ["string array of bottlenecks"],
  "objections": ["common objection patterns"],
  "proposedLessons": [{"lesson": "the insight", "confidence": 0.8}],
  "nextSteps": ["recommended actions"]
}`;

export async function runDailyDigest(
  supabase: SupabaseClient,
  openai: OpenAI,
): Promise<DigestResult> {
  const runResult = await insertBrainRun(supabase, {
    job: 'daily_digest',
    model: BRAIN_CONFIG.model,
    prompt_version: BRAIN_CONFIG.promptVersion,
    trigger_ref: null,
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
  const toolCalls: BrainToolCall[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: DAILY_DIGEST_PROMPT },
      { role: 'user', content: `Generate the daily digest for ${new Date().toISOString().split('T')[0]}.` },
    ];

    let response = await openai.chat.completions.create({
      model: BRAIN_CONFIG.model,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 2000,
    });

    totalInputTokens += response.usage?.prompt_tokens ?? 0;
    totalOutputTokens += response.usage?.completion_tokens ?? 0;

    while (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      const currentToolCalls = assistantMessage.tool_calls ?? [];
      for (const toolCall of currentToolCalls) {
        const result = await executeTool(supabase, toolCall, runId);
        toolCalls.push(result);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.result),
        });
      }

      response = await openai.chat.completions.create({
        model: BRAIN_CONFIG.model,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2000,
      });

      totalInputTokens += response.usage?.prompt_tokens ?? 0;
      totalOutputTokens += response.usage?.completion_tokens ?? 0;
    }

    const content = response.choices[0].message.content ?? '{}';
    let parsed: Partial<Omit<DigestResult, 'runId' | 'tokens' | 'cost'>>;

    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    const cost = estimateCost(totalInputTokens, totalOutputTokens, BRAIN_CONFIG.model);

    const result: DigestResult = {
      runId,
      working: asStringArray(parsed.working),
      notWorking: asStringArray(parsed.notWorking),
      bottlenecks: asStringArray(parsed.bottlenecks),
      objections: asStringArray(parsed.objections),
      proposedLessons: asLessonArray(parsed.proposedLessons),
      nextSteps: asStringArray(parsed.nextSteps),
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      cost,
    };

    await updateBrainRun(supabase, runId, {
      status: 'ok',
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cost_usd: cost,
      tool_calls: toolCalls,
      output: result,
      finished_at: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateBrainRun(supabase, runId, {
      status: 'error',
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      tool_calls: toolCalls,
      error: errorMessage,
      finished_at: new Date().toISOString(),
    });

    throw error;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asLessonArray(value: unknown): Array<{ lesson: string; confidence: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { lesson: string; confidence: number } =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).lesson === 'string',
    )
    .map((item) => ({
      lesson: item.lesson,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
    }));
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

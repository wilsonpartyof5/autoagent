/**
 * Brain LLM configuration. Model names are set via env so they can be swapped
 * without a code change. Shadow mode stays on unless BRAIN_SHADOW_MODE=false.
 */

export const DEFAULT_OPENAI_MODEL = 'gpt-6-astra';
export const DEFAULT_OPENAI_FALLBACK_MODEL = 'gpt-6.1-sol';
export const DEFAULT_OPENAI_FAST_MODEL = 'gpt-6-luna';
export const DEFAULT_REASONING_EFFORT = 'high';
export const DEFAULT_XAI_BASE_URL = 'https://api.x.ai/v1';
export const DEFAULT_XAI_MODEL = 'grok-4.7';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export function reasoningEffortFromEnv(value: string | undefined): ReasoningEffort {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return DEFAULT_REASONING_EFFORT;
}

export const BRAIN_CONFIG = {
  model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? DEFAULT_OPENAI_FALLBACK_MODEL,
  fastModel: process.env.OPENAI_FAST_MODEL ?? DEFAULT_OPENAI_FAST_MODEL,
  reasoningEffort: reasoningEffortFromEnv(process.env.OPENAI_REASONING_EFFORT),
  promptVersion: process.env.BRAIN_PROMPT_VERSION ?? '2.0.0',
  xaiBaseUrl: process.env.XAI_BASE_URL ?? DEFAULT_XAI_BASE_URL,
  xaiModel: process.env.XAI_MODEL ?? DEFAULT_XAI_MODEL,
} as const;

export const PUSHBACK_THRESHOLD = {
  absoluteDollars: Number(process.env.BRAIN_PUSHBACK_ABSOLUTE ?? 500),
  percentOfFair: Number(process.env.BRAIN_PUSHBACK_PERCENT ?? 0.015),
} as const;

/** Shadow mode is the default. Only the exact string "false" turns it off. */
export function shadowModeFromEnv(value: string | undefined): boolean {
  return value !== 'false';
}

export const SHADOW_MODE = shadowModeFromEnv(process.env.BRAIN_SHADOW_MODE);

export type BrainConfig = typeof BRAIN_CONFIG;
export type PushbackThreshold = typeof PUSHBACK_THRESHOLD;

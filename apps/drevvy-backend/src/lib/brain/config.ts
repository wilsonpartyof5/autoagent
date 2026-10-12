/**
 * Brain LLM configuration. Model names are set via env to allow swapping
 * without code changes.
 */

export const BRAIN_CONFIG = {
  model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  fastModel: process.env.OPENAI_FAST_MODEL ?? 'gpt-4o-mini',
  promptVersion: process.env.BRAIN_PROMPT_VERSION ?? '1.0.0',
} as const;

export const PUSHBACK_THRESHOLD = {
  absoluteDollars: Number(process.env.BRAIN_PUSHBACK_ABSOLUTE ?? 500),
  percentOfFair: Number(process.env.BRAIN_PUSHBACK_PERCENT ?? 0.015),
  mode: (process.env.BRAIN_PUSHBACK_MODE ?? 'greater') as 'greater' | 'lesser',
} as const;

export const SHADOW_MODE = process.env.BRAIN_SHADOW_MODE !== 'false';

export type BrainConfig = typeof BRAIN_CONFIG;
export type PushbackThreshold = typeof PUSHBACK_THRESHOLD;

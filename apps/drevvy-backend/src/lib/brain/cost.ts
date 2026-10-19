/**
 * Token prices in USD per 1M tokens: input / cached input / output.
 * gpt-4o keeps the previous per-1K rates converted to this table (legacy).
 */

export type ModelRate = {
  id: string;
  input: number;
  cached: number;
  output: number;
};

export const MODEL_RATES: readonly ModelRate[] = [
  { id: 'gpt-6-astra', input: 10, cached: 1, output: 50 },
  { id: 'gpt-6.1-sol', input: 2, cached: 0.1, output: 10 },
  { id: 'gpt-6-luna', input: 0.1, cached: 0.01, output: 0.5 },
  { id: 'grok-4.7', input: 2, cached: 0.5, output: 6 },
  { id: 'gpt-4o-mini', input: 0.15, cached: 0.075, output: 0.6 },
  { id: 'gpt-4-turbo', input: 10, cached: 5, output: 30 },
  { id: 'gpt-4o', input: 5, cached: 2.5, output: 15 },
];

const LEGACY_RATE = MODEL_RATES.find((rate) => rate.id === 'gpt-4o') as ModelRate;

export function rateForModel(model: string): ModelRate {
  const name = model.trim().toLowerCase();
  const match = [...MODEL_RATES]
    .sort((a, b) => b.id.length - a.id.length)
    .find((rate) => name === rate.id || name.startsWith(`${rate.id}-`) || name.startsWith(rate.id));
  return match ?? LEGACY_RATE;
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  cachedTokens = 0,
): number {
  const rate = rateForModel(model);
  const safeInput = Math.max(0, inputTokens);
  const safeOutput = Math.max(0, outputTokens);
  const cached = Math.max(0, Math.min(cachedTokens, safeInput));
  const uncached = safeInput - cached;
  const cost = (uncached / 1_000_000) * rate.input
    + (cached / 1_000_000) * rate.cached
    + (safeOutput / 1_000_000) * rate.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

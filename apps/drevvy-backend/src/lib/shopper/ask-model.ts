/**
 * Ask-only model chain. Chat-search stays on the gateway client.
 *
 * 1. Vercel AI Gateway (AI_GATEWAY_API_KEY, else VERCEL_OIDC_TOKEN) with
 *    openai/gpt-6-luna.
 * 2. When that credential is missing, or the gateway call fails with 401,
 *    403, or a network error, OpenAI at https://api.openai.com/v1 using
 *    OPENAI_API_KEY. The model is OPENAI_MODEL, or the deal-brain production
 *    default gpt-6-astra (DEFAULT_OPENAI_MODEL in brain/config.ts).
 * 3. The caller keeps the deterministic parser when both are missing or both fail.
 */

import OpenAI from 'openai';

import { DEFAULT_OPENAI_MODEL } from '@/lib/brain/config';

import { SHOPPING_GATEWAY_BASE_URL, SHOPPING_MODEL, shoppingGatewayCredential } from '../query/shopping-llm';

export const ASK_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const ASK_PARSE_MAX_TOKENS = 800;

export type AskModelProvider = 'gateway' | 'openai';

export type AskProviderChoice = {
  provider: AskModelProvider;
  apiKey: string;
  baseURL: string;
  model: string;
};

export type AskModelContext = {
  provider: AskModelProvider;
  model: string;
  baseURL: string;
  client: OpenAI;
  signal: AbortSignal;
};

export type AskModelResult<T> =
  | { ok: true; value: T; provider: AskModelProvider }
  | { ok: false };

export function askNativeModel(env: Record<string, string | undefined>): string {
  const configured = env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_OPENAI_MODEL;
}

export function askProviderPlan(env: Record<string, string | undefined>): AskProviderChoice[] {
  const plan: AskProviderChoice[] = [];
  const gateway = shoppingGatewayCredential(env);
  if (gateway) {
    plan.push({
      provider: 'gateway',
      apiKey: gateway,
      baseURL: SHOPPING_GATEWAY_BASE_URL,
      model: SHOPPING_MODEL,
    });
  }
  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    plan.push({
      provider: 'openai',
      apiKey: openaiKey,
      baseURL: ASK_OPENAI_BASE_URL,
      model: askNativeModel(env),
    });
  }
  return plan;
}

/** Auth and connection failures may try the next provider. A timeout does not. */
export function isAskProviderFallback(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error ? Number((error as { status?: unknown }).status) : Number.NaN;
  if (status === 401 || status === 403) return true;
  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError' || name === 'APIUserAbortError' || name === 'TimeoutError') return false;
  if (name === 'AuthenticationError' || name === 'PermissionDeniedError' || name === 'APIConnectionError') {
    return true;
  }
  if (error instanceof TypeError) return true;
  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  return code === 'ECONNRESET'
    || code === 'ECONNREFUSED'
    || code === 'ENOTFOUND'
    || code === 'ETIMEDOUT'
    || code === 'EAI_AGAIN'
    || code === 'UND_ERR_CONNECT_TIMEOUT';
}

export async function callAskModel<T>(
  env: Record<string, string | undefined>,
  run: (ctx: AskModelContext) => Promise<T>,
  options?: {
    timeoutMs?: number;
    createClient?: (choice: { apiKey: string; baseURL: string }) => OpenAI;
  },
): Promise<AskModelResult<T>> {
  const plan = askProviderPlan(env);
  const timeoutMs = options?.timeoutMs ?? 8_000;
  for (let index = 0; index < plan.length; index += 1) {
    const choice = plan[index];
    const client = options?.createClient
      ? options.createClient({ apiKey: choice.apiKey, baseURL: choice.baseURL })
      : new OpenAI({ apiKey: choice.apiKey, baseURL: choice.baseURL });
    try {
      const value = await run({
        provider: choice.provider,
        model: choice.model,
        baseURL: choice.baseURL,
        client,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { ok: true, value, provider: choice.provider };
    } catch (error) {
      const another = index < plan.length - 1;
      if (another && isAskProviderFallback(error)) continue;
      return { ok: false };
    }
  }
  return { ok: false };
}

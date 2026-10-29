/**
 * Shopper Ask/Shop model. This is the only LLM used to turn a shopper's
 * "what should I buy" / specific-model question into MarketCheck filters
 * and the grounded reply. Dealer brain, admin insights, and the widget
 * worker keep their own models.
 *
 * `openai/gpt-6-luna` is the cheapest interactive GPT-6 on Vercel AI Gateway
 * (not the batch variant). It supports structured output and tool use.
 */

import OpenAI from 'openai';

export const SHOPPING_MODEL = 'openai/gpt-6-luna';

export const SHOPPING_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

export function shoppingGatewayCredential(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const gateway = env.AI_GATEWAY_API_KEY?.trim();
  if (gateway) return gateway;
  const oidc = env.VERCEL_OIDC_TOKEN?.trim();
  if (oidc) return oidc;
  return undefined;
}

export function createShoppingModelClient(
  env: Record<string, string | undefined> = process.env,
): OpenAI {
  const apiKey = shoppingGatewayCredential(env);
  if (!apiKey) {
    throw new Error(
      'Shopper shopping model requires AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN',
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: SHOPPING_GATEWAY_BASE_URL,
  });
}

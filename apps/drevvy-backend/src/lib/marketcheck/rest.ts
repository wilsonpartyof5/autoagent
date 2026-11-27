import { MarketCheckUpstreamError, McpQuotaError, McpRateLimitError } from './mcp-client';
import { redactSecrets } from './secrets';
import { recordMarketCheckCall } from './usage';

/**
 * Plain GET against the MarketCheck REST API. The key goes on the outbound
 * request only and is never returned or logged. 404 and 422 read as "no data".
 */
export async function marketCheckGet(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  endpoint: string,
  timeoutMs = 8000,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.MARKETCHECK_API_KEY ?? '';
  if (!apiKey) throw new Error('MARKETCHECK_API_KEY is not configured');
  const base = (process.env.MARKETCHECK_BASE_URL ?? 'https://api.marketcheck.com').replace(/\/+$/, '');
  const query = new URLSearchParams({ api_key: apiKey });
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(name, String(value));
  }
  recordMarketCheckCall(endpoint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/v2/${path.replace(/^\/+/, '')}?${query.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 402) throw new McpQuotaError();
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10);
      throw new McpRateLimitError(Number.isNaN(retryAfter) ? 60 : retryAfter);
    }
    if (response.status === 404 || response.status === 422) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new MarketCheckUpstreamError(
        `MarketCheck ${endpoint} failed (${response.status}) ${redactSecrets(body).slice(0, 180)}`,
        response.status,
      );
    }
    const json = await response.json();
    if (Array.isArray(json)) return { items: json };
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MarketCheckUpstreamError(`MarketCheck ${endpoint} timed out`, null, 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

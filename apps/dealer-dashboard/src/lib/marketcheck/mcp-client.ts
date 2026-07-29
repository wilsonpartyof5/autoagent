/**
 * MarketCheck MCP HTTP Client
 *
 * Calls the hosted MarketCheck MCP server using JSON-RPC over the
 * StreamableHTTP transport:  https://api.marketcheck.com/mcp?api_key=...
 *
 * Design choices:
 * - No SDK dependency: plain fetch + JSON-RPC so this works in Next.js serverless.
 * - Stateless calls (no session negotiation) — the hosted server handles this.
 * - SSE fallback: if the server streams, we collect the first result frame.
 * - Typed errors for quota (402) and rate-limit (429) so callers can surface them.
 */

const MC_MCP_URL = (
  process.env.MARKETCHECK_MCP_URL ?? 'https://api.marketcheck.com/mcp'
).replace(/\/+$/, '');

const MC_API_KEY = process.env.MARKETCHECK_API_KEY ?? '';

// --------------------------------------------------------------------------
// Typed errors
// --------------------------------------------------------------------------

export class McpQuotaError extends Error {
  readonly code = 'MARKETCHECK_QUOTA_EXCEEDED';
  constructor() {
    super('Monthly MarketCheck API quota reached. Upgrade your plan to continue.');
    this.name = 'McpQuotaError';
  }
}

export class McpRateLimitError extends Error {
  readonly code = 'MARKETCHECK_RATE_LIMITED';
  readonly retryAfter?: number;
  constructor(retryAfter?: number) {
    super('Too many requests to MarketCheck. Please wait a moment and try again.');
    this.name = 'McpRateLimitError';
    this.retryAfter = retryAfter;
  }
}

// --------------------------------------------------------------------------
// MCP JSON-RPC types
// --------------------------------------------------------------------------

interface McpToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
}

interface McpToolResult {
  content: McpToolContent[];
  isError?: boolean;
}

interface McpJsonRpcSuccess {
  jsonrpc: '2.0';
  id: number;
  result: McpToolResult;
}

interface McpJsonRpcError {
  jsonrpc: '2.0';
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type McpJsonRpcResponse = McpJsonRpcSuccess | McpJsonRpcError;

// --------------------------------------------------------------------------
// Request ID counter (per process; not persisted across serverless cold starts)
// --------------------------------------------------------------------------

let requestCounter = 0;

// --------------------------------------------------------------------------
// Core call
// --------------------------------------------------------------------------

/**
 * Call a MarketCheck MCP tool and return the parsed JSON result from the
 * first text content block.
 *
 * Returns null when the listing/resource is not found or a non-fatal error
 * occurs.  Throws McpQuotaError or McpRateLimitError for hard failures that
 * callers must surface to the user.
 */
export async function callMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = 8000,
): Promise<T | null> {
  if (!MC_API_KEY) {
    throw new Error('MARKETCHECK_API_KEY is not configured');
  }

  const url = `${MC_MCP_URL}?api_key=${MC_API_KEY}`;
  const id = ++requestCounter;

  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  });

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: payload,
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(tid);

    if (res.status === 402) {
      throw new McpQuotaError();
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      throw new McpRateLimitError(isNaN(retryAfter) ? 60 : retryAfter);
    }

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        JSON.stringify({
          event: 'mc_mcp_http_error',
          tool: toolName,
          status: res.status,
          body: body.substring(0, 300),
        }),
      );
      return null;
    }

    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('text/event-stream')) {
      return await parseStreamingResponse<T>(res, toolName);
    }

    const json = (await res.json()) as McpJsonRpcResponse;
    return extractContent<T>(json, toolName);
  } catch (err) {
    clearTimeout(tid);

    if (err instanceof McpQuotaError || err instanceof McpRateLimitError) {
      throw err;
    }

    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error(
      JSON.stringify({
        event: isTimeout ? 'mc_mcp_timeout' : 'mc_mcp_exception',
        tool: toolName,
        timeoutMs,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function extractContent<T>(json: McpJsonRpcResponse, toolName: string): T | null {
  if ('error' in json) {
    console.error(
      JSON.stringify({
        event: 'mc_mcp_rpc_error',
        tool: toolName,
        code: json.error.code,
        message: json.error.message,
      }),
    );
    return null;
  }

  const result = json.result;
  if (!result) return null;

  if (result.isError) {
    const msg = result.content?.[0]?.text ?? 'unknown MCP tool error';
    console.error(JSON.stringify({ event: 'mc_mcp_tool_error', tool: toolName, msg }));
    return null;
  }

  const textBlock = result.content?.find((c) => c.type === 'text' && c.text);
  if (!textBlock?.text) return null;

  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    // If content is not JSON, return raw text as-is
    return textBlock.text as unknown as T;
  }
}

/** Collect the first data frame from an SSE response and parse it. */
async function parseStreamingResponse<T>(res: Response, toolName: string): Promise<T | null> {
  const text = await res.text().catch(() => '');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') continue;
    try {
      const msg = JSON.parse(payload) as McpJsonRpcResponse;
      const result = extractContent<T>(msg, toolName);
      if (result !== null) return result;
    } catch {
      continue;
    }
  }
  return null;
}

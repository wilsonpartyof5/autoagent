import { randomUUID } from 'crypto';
import { CONFIG } from '../config/env.js';

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type UpstreamCallResult =
  | {
      success: true;
      result: unknown;
      correlationId: string;
      upstreamRequestId: string;
      status: number;
      latencyMs: number;
    }
  | {
      success: false;
      error: string;
      errorCode: string;
      correlationId: string;
      upstreamRequestId: string;
      status?: number;
      latencyMs: number;
    };

export type MarketcheckDiagnostics = {
  provider: 'marketcheck_mcp';
  endpointOrigin: string;
  serverVersion?: string;
  schemaFingerprint?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastLatencyMs?: number;
  lastErrorCode?: string;
};

const configuredEndpoint = new URL(CONFIG.marketcheckMcpUrl);
// The developers.marketcheck.com endpoint is the interactive OAuth connector.
// Drevvy is a server-to-server client and must use the API-key hosted endpoint.
const serverEndpoint =
  configuredEndpoint.hostname === 'developers.marketcheck.com'
    ? new URL('https://api.marketcheck.com/mcp')
    : configuredEndpoint;

const diagnostics: MarketcheckDiagnostics = {
  provider: 'marketcheck_mcp',
  endpointOrigin: serverEndpoint.origin,
};

function endpointUrl(): URL {
  const endpoint = new URL(serverEndpoint);
  if (
    endpoint.hostname === 'api.marketcheck.com' &&
    !endpoint.searchParams.has('api_key')
  ) {
    endpoint.searchParams.set('api_key', CONFIG.marketcheckApiKey);
  }
  return endpoint;
}

function authHeaders(): Record<string, string> {
  if (
    CONFIG.marketcheckMcpAuthType === 'none' ||
    serverEndpoint.hostname === 'api.marketcheck.com'
  ) {
    return {};
  }
  if (CONFIG.marketcheckMcpAuthType === 'x-api-key') {
    return { 'x-api-key': CONFIG.marketcheckMcpAuthToken };
  }
  return { Authorization: `Bearer ${CONFIG.marketcheckMcpAuthToken}` };
}

function parseMcpResponse(body: string): JsonRpcResponse {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as JsonRpcResponse;
  }

  const dataLine = trimmed
    .split(/\r?\n/)
    .find((line) => line.startsWith('data:'));
  if (!dataLine) {
    throw new Error('No JSON-RPC data event in SSE response');
  }
  return JSON.parse(dataLine.replace(/^data:\s*/, '')) as JsonRpcResponse;
}

function stableFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function rpcCall(
  method: string,
  params: Record<string, unknown>,
  correlationId: string,
  retries = 2,
): Promise<UpstreamCallResult> {
  const upstreamRequestId = randomUUID();
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      CONFIG.marketcheckMcpTimeoutMs,
    );
    try {
      const response = await fetch(endpointUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'x-autoagent-correlation-id': correlationId,
          ...authHeaders(),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: upstreamRequestId,
          method,
          params,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        if (
          attempt < retries &&
          (response.status === 429 || response.status >= 500)
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * 2 ** attempt),
          );
          continue;
        }
        diagnostics.lastFailureAt = new Date().toISOString();
        diagnostics.lastLatencyMs = latencyMs;
        diagnostics.lastErrorCode = `HTTP_${response.status}`;
        return {
          success: false,
          error: `Upstream MCP returned HTTP ${response.status}`,
          errorCode: `HTTP_${response.status}`,
          correlationId,
          upstreamRequestId,
          status: response.status,
          latencyMs,
        };
      }

      let parsed: JsonRpcResponse;
      try {
        parsed = parseMcpResponse(await response.text());
      } catch {
        diagnostics.lastFailureAt = new Date().toISOString();
        diagnostics.lastErrorCode = 'MCP_MALFORMED_RESPONSE';
        return {
          success: false,
          error: 'Upstream MCP returned malformed JSON/SSE',
          errorCode: 'MCP_MALFORMED_RESPONSE',
          correlationId,
          upstreamRequestId,
          status: response.status,
          latencyMs,
        };
      }
      if (parsed.jsonrpc !== '2.0' || parsed.id === undefined) {
        return {
          success: false,
          error: 'Upstream MCP returned invalid JSON-RPC envelope',
          errorCode: 'MCP_INVALID_ENVELOPE',
          correlationId,
          upstreamRequestId,
          status: response.status,
          latencyMs,
        };
      }
      if (parsed.error) {
        diagnostics.lastFailureAt = new Date().toISOString();
        diagnostics.lastLatencyMs = latencyMs;
        diagnostics.lastErrorCode = `RPC_${parsed.error.code}`;
        return {
          success: false,
          error: `Upstream MCP error ${parsed.error.code}: ${parsed.error.message}`,
          errorCode: `RPC_${parsed.error.code}`,
          correlationId,
          upstreamRequestId,
          status: response.status,
          latencyMs,
        };
      }

      diagnostics.lastSuccessAt = new Date().toISOString();
      diagnostics.lastLatencyMs = latencyMs;
      diagnostics.lastErrorCode = undefined;
      return {
        success: true,
        result: parsed.result,
        correlationId,
        upstreamRequestId,
        status: response.status,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const aborted = error instanceof Error && error.name === 'AbortError';
      const errorCode = aborted ? 'MCP_TIMEOUT' : 'MCP_NETWORK_ERROR';
      if (!aborted && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
        continue;
      }
      diagnostics.lastFailureAt = new Date().toISOString();
      diagnostics.lastLatencyMs = latencyMs;
      diagnostics.lastErrorCode = errorCode;
      return {
        success: false,
        error: aborted
          ? `Upstream MCP timeout after ${CONFIG.marketcheckMcpTimeoutMs}ms`
          : `Upstream MCP request failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
        errorCode,
        correlationId,
        upstreamRequestId,
        latencyMs,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error('Unreachable MarketCheck MCP retry state');
}

export async function callMarketcheckMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  correlationId: string,
): Promise<UpstreamCallResult> {
  return rpcCall(
    'tools/call',
    { name: toolName, arguments: args },
    correlationId,
  );
}

export async function inspectMarketcheckMcpContract(
  correlationId: string = randomUUID(),
): Promise<UpstreamCallResult> {
  const result = await rpcCall('tools/list', {}, correlationId, 0);
  if (result.success) {
    const tools = (
      result.result as { tools?: Array<Record<string, unknown>> } | undefined
    )?.tools;
    const searchTool = tools?.find((tool) => tool.name === 'search_active_cars');
    diagnostics.schemaFingerprint = searchTool
      ? stableFingerprint(searchTool)
      : undefined;
  }
  return result;
}

export function getMarketcheckMcpDiagnostics(): MarketcheckDiagnostics {
  return { ...diagnostics };
}

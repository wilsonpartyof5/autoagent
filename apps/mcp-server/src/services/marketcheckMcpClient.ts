import { randomUUID } from 'crypto';
import { CONFIG } from '../config/env.js';

type JsonRpcSuccess = {
  jsonrpc: '2.0';
  id: string;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: '2.0';
  id: string;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

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
      correlationId: string;
      upstreamRequestId: string;
      status?: number;
      latencyMs: number;
    };

function buildAuthHeaders(): Record<string, string> {
  if (CONFIG.marketcheckMcpAuthType === 'none') {
    return {};
  }

  const token = CONFIG.marketcheckMcpAuthToken;
  if (!token) {
    return {};
  }

  if (CONFIG.marketcheckMcpAuthType === 'x-api-key') {
    return { 'x-api-key': token };
  }

  return { Authorization: `Bearer ${token}` };
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.jsonrpc === '2.0' && typeof candidate.id === 'string';
}

export async function callMarketcheckMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  correlationId: string
): Promise<UpstreamCallResult> {
  const startedAt = Date.now();
  const upstreamRequestId = randomUUID();

  const controller = new AbortController();
  const timeoutMs = CONFIG.marketcheckMcpTimeoutMs;
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    jsonrpc: '2.0',
    id: upstreamRequestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  try {
    const response = await fetch(CONFIG.marketcheckMcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-autoagent-correlation-id': correlationId,
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        success: false,
        error: `Upstream MCP returned HTTP ${response.status}`,
        correlationId,
        upstreamRequestId,
        status: response.status,
        latencyMs,
      };
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (_error) {
      return {
        success: false,
        error: 'Upstream MCP returned malformed JSON',
        correlationId,
        upstreamRequestId,
        status: response.status,
        latencyMs,
      };
    }

    if (!isJsonRpcResponse(parsed)) {
      return {
        success: false,
        error: 'Upstream MCP returned invalid JSON-RPC envelope',
        correlationId,
        upstreamRequestId,
        status: response.status,
        latencyMs,
      };
    }

    if ('error' in parsed) {
      return {
        success: false,
        error: `Upstream MCP error ${parsed.error.code}: ${parsed.error.message}`,
        correlationId,
        upstreamRequestId,
        status: response.status,
        latencyMs,
      };
    }

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
    const message = error instanceof Error ? error.message : 'Unknown bridge error';
    return {
      success: false,
      error: message.includes('abort')
        ? `Upstream MCP timeout after ${timeoutMs}ms`
        : `Upstream MCP request failed: ${message}`,
      correlationId,
      upstreamRequestId,
      latencyMs,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

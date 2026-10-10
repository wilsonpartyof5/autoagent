import { NextRequest, NextResponse } from 'next/server';
import { callMcpTool, McpQuotaError, McpRateLimitError } from '@/lib/marketcheck/mcp-client';

/**
 * GET /api/inventory/health
 *
 * MVP validation endpoint.  Calls get_server_info on the MarketCheck MCP
 * server (the only free tool) to verify that the MCP connection, API key,
 * and network path are all working.  Returns a structured result suitable
 * for CI smoke tests and operational dashboards.
 *
 * Authentication: same x-api-key / Bearer header as other inventory routes.
 *
 * Response:
 * {
 *   "success": true,
 *   "checks": {
 *     "mcp_connection": { "ok": true, "latencyMs": 320 },
 *     "api_key_configured": { "ok": true },
 *     "mcp_url_configured": { "ok": true }
 *   },
 *   "overall": "healthy" | "degraded" | "down"
 * }
 */

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  if (!apiKey) return false;
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7) === apiKey) return true;
  return false;
}

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
      { status: 401 },
    );
  }

  const checks: Record<string, CheckResult> = {};

  // Check 1: API key configured
  checks.api_key_configured = {
    ok: Boolean(process.env.MARKETCHECK_API_KEY),
    ...(!process.env.MARKETCHECK_API_KEY && { error: 'MARKETCHECK_API_KEY env var is not set' }),
  };

  // Check 2: MCP URL configured (has default so always ok)
  checks.mcp_url_configured = {
    ok: true,
    ...(process.env.MARKETCHECK_MCP_URL && { note: process.env.MARKETCHECK_MCP_URL } as Record<string, unknown>),
  };

  // Check 3: Live MCP connectivity — use free get_server_info tool
  const t0 = Date.now();
  let mcpOk = false;
  let mcpError: string | undefined;

  try {
    const info = await callMcpTool<Record<string, unknown>>('get_server_info', {}, 6000);
    mcpOk = info !== null;
    if (!mcpOk) mcpError = 'get_server_info returned null (check API key or MCP URL)';
  } catch (err) {
    if (err instanceof McpQuotaError) {
      // Quota error means connectivity works — the server is reachable
      mcpOk = true;
      mcpError = 'quota_exceeded (but MCP connection is alive)';
    } else if (err instanceof McpRateLimitError) {
      mcpOk = true;
      mcpError = 'rate_limited (but MCP connection is alive)';
    } else {
      mcpError = err instanceof Error ? err.message : String(err);
    }
  }

  checks.mcp_connection = {
    ok: mcpOk,
    latencyMs: Date.now() - t0,
    ...(mcpError && { error: mcpError }),
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const anyOk = Object.values(checks).some((c) => c.ok);
  const overall = allOk ? 'healthy' : anyOk ? 'degraded' : 'down';

  console.log(JSON.stringify({ event: 'inventory_health_check', overall, checks }));

  return NextResponse.json(
    { success: true, checks, overall },
    { status: allOk ? 200 : 503 },
  );
}

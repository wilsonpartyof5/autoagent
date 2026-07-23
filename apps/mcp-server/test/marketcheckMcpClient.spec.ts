import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/config/env.js', () => ({
  CONFIG: {
    marketcheckMcpUrl: 'https://upstream.example.com/mcp',
    marketcheckMcpAuthType: 'bearer',
    marketcheckMcpAuthToken: 'secret-token',
    marketcheckMcpTimeoutMs: 5000,
    marketcheckApiKey: 'test-api-key',
  },
}));

describe('marketcheckMcpClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns success for valid upstream JSON-RPC result', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        jsonrpc: '2.0',
        id: 'abc',
        result: {
          content: [{ type: 'text', text: 'ok' }],
          structuredContent: { results: { vehicles: [], totalCount: 0 } },
          components: [{ type: 'iframe', url: 'https://widget.example.com' }],
        },
      }),
    });

    const { callMarketcheckMcpTool } = await import('../src/services/marketcheckMcpClient.js');
    const result = await callMarketcheckMcpTool('search-vehicles', { location: 'Seattle, WA' }, 'corr-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe(200);
      expect(result.result).toBeDefined();
    }
  });

  it('handles non-200 HTTP responses', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '{}',
    });

    const { callMarketcheckMcpTool } = await import('../src/services/marketcheckMcpClient.js');
    const result = await callMarketcheckMcpTool('search-vehicles', { location: 'Seattle, WA' }, 'corr-2');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(502);
      expect(result.error).toContain('HTTP 502');
    }
  });

  it('handles malformed upstream JSON payloads', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'invalid json',
    });

    const { callMarketcheckMcpTool } = await import('../src/services/marketcheckMcpClient.js');
    const result = await callMarketcheckMcpTool('search-vehicles', { location: 'Seattle, WA' }, 'corr-3');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('MCP_MALFORMED_RESPONSE');
    }
  });

  it('handles upstream JSON-RPC error object over HTTP 200', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        jsonrpc: '2.0',
        id: 'abc',
        error: {
          code: -32000,
          message: 'upstream failure',
        },
      }),
    });

    const { callMarketcheckMcpTool } = await import('../src/services/marketcheckMcpClient.js');
    const result = await callMarketcheckMcpTool('search-vehicles', { location: 'Seattle, WA' }, 'corr-4');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('upstream failure');
    }
  });

  it('handles invalid JSON-RPC envelopes', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        unexpected: true,
      }),
    });

    const { callMarketcheckMcpTool } = await import('../src/services/marketcheckMcpClient.js');
    const result = await callMarketcheckMcpTool('search-vehicles', { location: 'Seattle, WA' }, 'corr-5');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('MCP_INVALID_ENVELOPE');
    }
  });
});

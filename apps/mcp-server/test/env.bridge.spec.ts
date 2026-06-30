import { describe, it, expect, beforeEach, vi } from 'vitest';

const REQUIRED_ENV = {
  WIDGET_HOST: 'https://example.com',
  MARKETCHECK_API_KEY: 'test-marketcheck-key',
  LEAD_ENC_KEY: Buffer.alloc(32).toString('base64'),
  DASHBOARD_INGEST_URL: 'https://dashboard.example.com/api/ingest/lead',
  DASHBOARD_INGEST_TOKEN: 'test-token',
};

describe('bridge env validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...process.env,
      ...REQUIRED_ENV,
    };
    delete process.env.MARKETCHECK_MCP_URL;
    delete process.env.MARKETCHECK_MCP_AUTH_TOKEN;
    delete process.env.MARKETCHECK_MCP_AUTH_TYPE;
    delete process.env.MARKETCHECK_MCP_BRIDGE_ENABLED;
  });

  it('fails fast when bridge is enabled without URL', async () => {
    process.env.MARKETCHECK_MCP_BRIDGE_ENABLED = '1';

    await expect(import('../src/config/env.js')).rejects.toThrow(
      'MARKETCHECK_MCP_URL is required'
    );
  });

  it('does not require bridge env when bridge mode is disabled', async () => {
    process.env.MARKETCHECK_MCP_BRIDGE_ENABLED = '0';

    const { CONFIG } = await import('../src/config/env.js');
    expect(CONFIG.marketcheckMcpBridgeEnabled).toBe(false);
    expect(CONFIG.marketcheckMcpUrl).toBe('');
  });
});

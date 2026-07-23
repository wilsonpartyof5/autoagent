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
    delete process.env.INVENTORY_SEARCH_PROVIDER;
  });

  it('uses the official hosted MCP when MarketCheck is primary', async () => {
    process.env.MARKETCHECK_MCP_BRIDGE_ENABLED = '1';
    const { CONFIG } = await import('../src/config/env.js');
    expect(CONFIG.inventorySearchProvider).toBe('marketcheck_mcp');
    expect(CONFIG.marketcheckMcpUrl).toBe('https://api.marketcheck.com/mcp');
  });

  it('allows an explicit UVS primary override', async () => {
    process.env.MARKETCHECK_MCP_BRIDGE_ENABLED = '0';
    process.env.INVENTORY_SEARCH_PROVIDER = 'uvs';

    const { CONFIG } = await import('../src/config/env.js');
    expect(CONFIG.marketcheckMcpBridgeEnabled).toBe(false);
    expect(CONFIG.inventorySearchProvider).toBe('uvs');
  });
});

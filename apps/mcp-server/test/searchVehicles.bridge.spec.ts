import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCallMarketcheckMcpTool = vi.fn();

vi.mock('../src/config/env.js', () => ({
  CONFIG: {
    diagnosticsEnabled: false,
    marketcheckMcpBridgeEnabled: true,
    inventorySearchProvider: 'marketcheck_mcp',
    leadEncKey: Buffer.alloc(32).toString('base64'),
    widgetHost: 'https://example.com',
  },
}));

vi.mock('../src/services/marketcheckMcpClient.js', () => ({
  callMarketcheckMcpTool: (...args: unknown[]) => mockCallMarketcheckMcpTool(...args),
}));

vi.mock('../src/lib/analytics/tracking.js', () => ({
  trackEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock('../src/lib/flowTelemetry.js', () => ({
  recordFlowEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock('../src/db/uvs-vehicles.js', () => ({
  searchUVSVehicles: vi.fn(() => Promise.resolve({ vehicles: [], total: 0, dealerSummary: [] })),
}));

describe('searchVehicles bridge mode', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCallMarketcheckMcpTool.mockReset();
  });

  it('returns normalized data from upstream MCP result', async () => {
    mockCallMarketcheckMcpTool.mockResolvedValue({
      success: true,
      result: {
        structuredContent: {
          success: true,
          data: {
            num_found: 1,
            listings: [{
              id: 'veh-1',
              vin: '1HGCM82633A123456',
              price: 25000,
              inventory_type: 'used',
              build: { year: 2024, make: 'Test', model: 'Car' },
              dealer: { id: 'dealer-1', name: 'Test Dealer' },
            }],
          },
        },
        content: [{ type: 'text', text: 'Found 1 vehicle' }],
      },
      correlationId: 'corr-1',
      upstreamRequestId: 'up-1',
      status: 200,
      latencyMs: 42,
    });

    const { searchVehicles } = await import('../src/tools/searchVehicles.js');
    const result = await searchVehicles({
      location: 'Seattle, WA',
      condition: 'used',
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalCount).toBe(1);
    expect(result.data?.vehicles).toHaveLength(1);
  });

  it('falls back to UVS when upstream bridge call fails', async () => {
    mockCallMarketcheckMcpTool.mockResolvedValue({
      success: false,
      error: 'Upstream MCP returned HTTP 502',
      errorCode: 'HTTP_502',
      correlationId: 'corr-2',
      upstreamRequestId: 'up-2',
      status: 502,
      latencyMs: 22,
    });

    const { searchVehicles } = await import('../src/tools/searchVehicles.js');
    const result = await searchVehicles({
      location: 'Seattle, WA',
      condition: 'used',
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalCount).toBe(0);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCallMarketcheckMcpTool = vi.fn();

vi.mock('../src/config/env.js', () => ({
  CONFIG: {
    diagnosticsEnabled: false,
    marketcheckMcpBridgeEnabled: true,
    widgetHost: 'https://example.com',
  },
}));

vi.mock('../src/services/marketcheckMcpClient.js', () => ({
  callMarketcheckMcpTool: (...args: unknown[]) => mockCallMarketcheckMcpTool(...args),
}));

vi.mock('../src/lib/analytics/tracking.js', () => ({
  trackEvent: vi.fn(() => Promise.resolve()),
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
          results: {
            vehicles: [{ id: 'veh-1', title: '2024 Test Car' }],
            totalCount: 1,
          },
        },
        content: [{ type: 'text', text: 'Found 1 vehicle' }],
        components: [{ type: 'iframe', url: 'https://example.com/widget/vehicle-results?rid=test' }],
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
    expect(result.data?.components[0]?.type).toBe('iframe');
  });

  it('returns explicit error when upstream bridge call fails', async () => {
    mockCallMarketcheckMcpTool.mockResolvedValue({
      success: false,
      error: 'Upstream MCP returned HTTP 502',
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

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 502');
  });
});

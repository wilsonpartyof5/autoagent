import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMcpToolCall = vi.fn();

vi.mock('../src/mcp-simple.js', () => ({
  getAvailableTools: vi.fn(() => []),
  getAvailableResources: vi.fn(() => []),
  readMcpResource: vi.fn(),
  VEHICLE_RESULTS_RESOURCE_URI: 'ui://vehicle-results-v18.html',
  VEHICLE_WIDGET_VERSION: 'v18',
  handleMcpToolCall: (...args: unknown[]) => handleMcpToolCall(...args),
}));

vi.mock('../src/config/env.js', () => ({
  CONFIG: { commitSha: 'test-commit' },
}));

describe('MCP tool result handling', () => {
  beforeEach(() => handleMcpToolCall.mockReset());

  it('returns direct submit-lead content without an internal error', async () => {
    handleMcpToolCall.mockResolvedValue({
      success: true,
      content: [{ type: 'text', text: 'Lead submitted successfully.' }],
      structuredContent: {
        leadId: 'lead-1',
        vehicleId: 'vehicle-1',
        dealerId: 'dealer-1',
      },
    });
    const { handleMcpRequest } = await import('../src/mcp-handler.js');
    const response = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'submit-lead', arguments: {} },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'text', text: 'Lead submitted successfully.' }],
        structuredContent: { leadId: 'lead-1' },
      },
    });
    expect(response).not.toHaveProperty('error');
  });

  it('continues to unwrap data-wrapped search results', async () => {
    handleMcpToolCall.mockResolvedValue({
      success: true,
      data: {
        content: [{ type: 'text', text: 'Found vehicles.' }],
        structuredContent: { results: { vehicles: [], totalCount: 0 } },
      },
    });
    const { handleMcpRequest } = await import('../src/mcp-handler.js');
    const response = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'search-vehicles', arguments: {} },
    });
    expect(response).toHaveProperty('result.structuredContent.results.totalCount', 0);
  });
});

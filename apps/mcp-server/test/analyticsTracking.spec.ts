import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordFlowEvent = vi.fn(() => Promise.resolve());

vi.mock('../src/config/env.js', () => ({
  CONFIG: { inventorySearchProvider: 'marketcheck_mcp' },
}));

vi.mock('../src/lib/flowTelemetry.js', () => ({
  recordFlowEvent: (...args: unknown[]) => recordFlowEvent(...args),
}));

describe('analytics compatibility tracking', () => {
  beforeEach(() => recordFlowEvent.mockClear());

  it('writes legacy event calls into the app event pipeline', async () => {
    const { trackEvent } = await import('../src/lib/analytics/tracking.js');
    await trackEvent(
      'inventory.search',
      {
        location: 'Charlotte, NC',
        resultsCount: 10,
        searchDuration: 125,
      },
      { sessionId: 'flow-1', requestId: 'request-1' },
    );

    expect(recordFlowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        flowId: 'flow-1',
        eventName: 'inventory.search',
        source: 'mcp-server',
        provider: 'marketcheck_mcp',
        requestId: 'request-1',
      }),
    );
  });
});

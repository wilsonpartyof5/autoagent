import { describe, expect, it } from 'vitest';
import {
  getAvailableResources,
  getAvailableTools,
  TOOL_HINT_JUSTIFICATIONS,
} from '../src/mcp-simple.js';

const PUBLIC_TOOL_NAMES = [
  'render-vehicle-results-v2',
  'get-vehicle-details',
  'submit-lead',
] as const;

const HIDDEN_TOOL_NAMES = [
  'search',
  'search-vehicles',
  'fetch',
  'ping-ui',
  'ping-micro-ui',
  'compare-vehicles',
] as const;

describe('public MCP tool surface', () => {
  it('advertises only the three customer tools OpenAI Scan Tools should import', () => {
    const names = getAvailableTools().map((tool) => tool.name);
    expect(names).toEqual([...PUBLIC_TOOL_NAMES]);
    for (const hidden of HIDDEN_TOOL_NAMES) {
      expect(names).not.toContain(hidden);
    }
  });

  it('labels look-up tools as read-only and the quote tool as a third-party write', () => {
    const tools = Object.fromEntries(getAvailableTools().map((tool) => [tool.name, tool]));

    expect(tools['render-vehicle-results-v2']).toMatchObject({
      title: 'Search cars',
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    });
    expect(tools['render-vehicle-results-v2'].outputSchema).toBeDefined();

    expect(tools['get-vehicle-details']).toMatchObject({
      title: 'Vehicle details',
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    });
    expect(tools['get-vehicle-details'].outputSchema).toBeDefined();

    expect(tools['submit-lead']).toMatchObject({
      title: 'Request a quote',
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
    });
    expect(tools['submit-lead'].outputSchema).toBeDefined();
  });

  it('has a matching OpenAI form justification for every advertised hint', () => {
    for (const tool of getAvailableTools()) {
      const justifications = TOOL_HINT_JUSTIFICATIONS[tool.name as keyof typeof TOOL_HINT_JUSTIFICATIONS];
      expect(justifications.readOnlyHint.length).toBeGreaterThan(10);
      expect(justifications.openWorldHint.length).toBeGreaterThan(10);
      expect(justifications.destructiveHint.length).toBeGreaterThan(10);
    }
  });

  it('lists only the vehicle-results widget resource', () => {
    const uris = getAvailableResources().map((resource) => resource.uri);
    expect(uris).toEqual(['ui://vehicle-results-v34.html']);
    expect(uris).not.toContain('ui://ping.html');
    expect(uris).not.toContain('ui://micro.html');
  });
});

import { describe, expect, it } from 'vitest';
import { getAvailableResources, getAvailableTools } from '../src/mcp-simple.js';

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

  it('sets readOnly, openWorld, and destructive hints on every advertised tool', () => {
    for (const tool of getAvailableTools()) {
      expect(tool.annotations, tool.name).toMatchObject({
        readOnlyHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
      });
    }
  });

  it('lists only the vehicle-results widget resource', () => {
    const uris = getAvailableResources().map((resource) => resource.uri);
    expect(uris).toEqual(['ui://vehicle-results-v34.html']);
    expect(uris).not.toContain('ui://ping.html');
    expect(uris).not.toContain('ui://micro.html');
  });
});

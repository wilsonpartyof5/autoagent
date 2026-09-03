import { describe, expect, it, vi } from 'vitest';
import { fetchContent } from '../src/tools/fetch.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetch tool is disabled', () => {
  it('never calls upstream fetch', async () => {
    const result = await fetchContent({ url: 'https://example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available|disabled/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects any URL without touching the network', async () => {
    const result = await fetchContent({ url: 'http://169.254.169.254/' });
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

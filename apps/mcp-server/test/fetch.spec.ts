import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchContent } from '../src/tools/fetch.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchContent Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Parameter validation', () => {
    it('should validate required url parameter', async () => {
      const result = await fetchContent({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('url is required and must be a string');
    });

    it('should validate url parameter type', async () => {
      const result = await fetchContent({ url: 123 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('url is required and must be a string');
    });

    it('should validate URL format', async () => {
      const result = await fetchContent({ url: 'not-a-url' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should accept valid URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve('<html>Test content</html>'),
      });

      const result = await fetchContent({ url: 'https://example.com' });
      
      expect(result.success).toBe(true);
      expect(result.data?.content).toBeDefined();
    });
  });

  describe('HTTP requests', () => {
    it('should make GET request with correct headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve('<html>Test content</html>'),
      });

      await fetchContent({ url: 'https://example.com' });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        method: 'GET',
        headers: {
          'User-Agent': 'AutoAgent-MCP-Server/1.0.0',
          'Accept': 'text/html,text/plain,application/json,*/*',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle successful responses', async () => {
      const testContent = '<html><body>Test content</body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html; charset=utf-8']]),
        text: () => Promise.resolve(testContent),
      });

      const result = await fetchContent({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.content[0].text).toContain('Content from https://example.com:');
      expect(result.data?.content[0].text).toContain(testContent);
      expect(result.data?.structuredContent).toMatchObject({
        url: 'https://example.com',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        contentLength: testContent.length,
        content: testContent,
      });
    });

    it('should handle JSON responses', async () => {
      const jsonData = { message: 'Hello World', count: 42 };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(jsonData),
      });

      const result = await fetchContent({ url: 'https://api.example.com/data' });

      expect(result.success).toBe(true);
      expect(result.data?.content[0].text).toContain(JSON.stringify(jsonData, null, 2));
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve('<html>404 Not Found</html>'),
      });

      const result = await fetchContent({ url: 'https://example.com/not-found' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchContent({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle timeout errors', async () => {
      // Mock AbortSignal.timeout to throw AbortError
      const originalAbortSignal = global.AbortSignal;
      global.AbortSignal = {
        ...originalAbortSignal,
        timeout: vi.fn().mockImplementation(() => {
          const signal = new AbortController().signal;
          setTimeout(() => signal.dispatchEvent(new Event('abort')), 0);
          return signal;
        }),
      } as any;

      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        })
      );

      const result = await fetchContent({ url: 'https://slow-site.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AbortError');

      // Restore original AbortSignal
      global.AbortSignal = originalAbortSignal;
    });
  });

  describe('Content handling', () => {
    it('should truncate very long content', async () => {
      const longContent = 'A'.repeat(60000); // 60KB
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve(longContent),
      });

      const result = await fetchContent({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.content[0].text).toContain('... (content truncated)');
      expect(result.data?.structuredContent?.contentLength).toBeLessThanOrEqual(50025);
    });

    it('should preserve short content', async () => {
      const shortContent = 'Short content';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve(shortContent),
      });

      const result = await fetchContent({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.content[0].text).toContain(shortContent);
      expect(result.data?.content[0].text).not.toContain('... (content truncated)');
    });

    it('should handle different content types', async () => {
      const testCases = [
        { contentType: 'text/html', content: '<html>HTML content</html>' },
        { contentType: 'text/plain', content: 'Plain text content' },
        { contentType: 'application/json', content: '{"key": "value"}' },
        { contentType: 'application/xml', content: '<xml>XML content</xml>' },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map([['content-type', testCase.contentType]]),
          text: () => Promise.resolve(testCase.content),
          json: () => Promise.resolve(JSON.parse(testCase.content)),
        });

        const result = await fetchContent({ url: 'https://example.com' });

        expect(result.success).toBe(true);
        if (testCase.contentType.includes('application/json')) {
          expect(result.data?.content[0].text).toContain(JSON.stringify(JSON.parse(testCase.content), null, 2));
        } else {
          expect(result.data?.content[0].text).toContain(testCase.content);
        }
        expect(result.data?.structuredContent?.contentType).toBe(testCase.contentType);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle invalid parameters', async () => {
      const result = await fetchContent(null as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    it('should handle missing url', async () => {
      const result = await fetchContent({ url: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('url is required and must be a string');
    });

    it('should handle malformed URLs', async () => {
      const result = await fetchContent({ url: 'http://[invalid-url' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should handle fetch exceptions', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await fetchContent({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('Response format', () => {
    it('should return content in correct format', async () => {
      const testContent = 'Test response content';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve(testContent),
      });

      const result = await fetchContent({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Content from https://example.com:'),
          },
        ],
        structuredContent: {
          url: 'https://example.com',
          status: 200,
          contentType: 'text/plain',
          contentLength: testContent.length,
          content: testContent,
        },
        components: [],
      });
    });
  });
});

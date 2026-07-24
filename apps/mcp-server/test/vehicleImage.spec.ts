import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', () => ({
  CONFIG: {
    leadEncKey: Buffer.alloc(32, 7).toString('base64'),
    widgetHost: 'https://autoagent.example',
    marketcheckApiKey: 'marketcheck-test-key',
  },
}));

describe('vehicle image proxy', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('signs image URLs without exposing the MarketCheck key', async () => {
    const { proxiedVehicleImageUrl } = await import('../src/app/vehicle-image.js');
    const proxied = proxiedVehicleImageUrl(
      'https://api.marketcheck.com/v2/image/cache/car/example/photo',
    );
    expect(proxied).toContain('https://autoagent.example/vehicle-image?');
    expect(proxied).toContain('sig=');
    expect(proxied).not.toContain('marketcheck-test-key');
  });

  it('fetches a signed MarketCheck image with server-side authentication', async () => {
    const { handleVehicleImage, proxiedVehicleImageUrl } = await import('../src/app/vehicle-image.js');
    const proxied = new URL(
      proxiedVehicleImageUrl(
        'https://api.marketcheck.com/v2/image/cache/car/example/photo',
      ),
    );
    global.fetch = vi.fn(async (target: string | URL | Request) => {
      const targetUrl = new URL(String(target));
      expect(targetUrl.searchParams.get('api_key')).toBe('marketcheck-test-key');
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
      });
    }) as typeof fetch;

    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) { this.headers[name] = value; },
      status(code: number) { this.statusCode = code; return this; },
      send: vi.fn(function (this: any, body: Buffer) { this.body = body; return this; }),
      json: vi.fn(function (this: any, body: unknown) { this.body = body; return this; }),
    };
    await handleVehicleImage(
      { query: Object.fromEntries(proxied.searchParams) } as any,
      response as any,
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('image/jpeg');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Cross-Origin-Resource-Policy']).toBe('cross-origin');
    expect(response.send).toHaveBeenCalled();
  });

  it('rejects unsigned requests', async () => {
    const { handleVehicleImage } = await import('../src/app/vehicle-image.js');
    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) { this.headers[name] = value; },
      status(code: number) { this.statusCode = code; return this; },
      json: vi.fn(function (this: any) { return this; }),
    };
    await handleVehicleImage(
      { query: { src: 'invalid', sig: 'invalid' } } as any,
      response as any,
    );
    expect(response.statusCode).toBe(403);
  });
});

import { describe, expect, it } from 'vitest';
import { assertSafeHttpsUrl, stripSensitiveQueryParams } from '../src/lib/safeHttpUrl.js';

describe('assertSafeHttpsUrl', () => {
  it('allows a public HTTPS CRM endpoint', () => {
    expect(assertSafeHttpsUrl('https://crm.example.com/leads').ok).toBe(true);
  });

  it('rejects http, localhost, and private IPs', () => {
    expect(assertSafeHttpsUrl('http://crm.example.com/leads').ok).toBe(false);
    expect(assertSafeHttpsUrl('https://localhost/leads').ok).toBe(false);
    expect(assertSafeHttpsUrl('https://127.0.0.1/leads').ok).toBe(false);
    expect(assertSafeHttpsUrl('https://10.0.0.8/leads').ok).toBe(false);
    expect(assertSafeHttpsUrl('https://192.168.1.20/leads').ok).toBe(false);
    expect(assertSafeHttpsUrl('https://169.254.169.254/latest/meta-data').ok).toBe(false);
  });
});

describe('stripSensitiveQueryParams', () => {
  it('removes api_key from photo URLs', () => {
    const cleaned = stripSensitiveQueryParams(
      'https://api.marketcheck.com/image.jpg?api_key=secret&w=800',
    );
    expect(cleaned).not.toContain('secret');
    expect(cleaned).not.toContain('api_key');
    expect(cleaned).toContain('w=800');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  acceptLeadSubmission,
  resetLeadRateLimitForTests,
  LEAD_RATE_LIMIT,
} from '../src/lib/leadRateLimit.js';

describe('leadRateLimit', () => {
  beforeEach(() => {
    resetLeadRateLimitForTests();
  });

  it('allows five submissions from the same shopper and blocks the sixth', () => {
    for (let i = 0; i < LEAD_RATE_LIMIT.max; i += 1) {
      expect(acceptLeadSubmission('198.51.100.10')).toBe(true);
    }
    expect(acceptLeadSubmission('198.51.100.10')).toBe(false);
  });

  it('does not store or compare raw IP strings as keys', () => {
    expect(acceptLeadSubmission('198.51.100.10')).toBe(true);
    expect(acceptLeadSubmission('198.51.100.11')).toBe(true);
    expect(acceptLeadSubmission()).toBe(true);
  });

  it('tracks missing IPs separately from a real shopper', () => {
    for (let i = 0; i < LEAD_RATE_LIMIT.max; i += 1) {
      expect(acceptLeadSubmission('198.51.100.10')).toBe(true);
    }
    expect(acceptLeadSubmission()).toBe(true);
  });
});

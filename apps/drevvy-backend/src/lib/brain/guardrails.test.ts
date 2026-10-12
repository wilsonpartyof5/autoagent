import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { runGuardrails, checkOtdThreshold, computeOtdThreshold, type GuardrailInput } from './guardrails';

describe('runGuardrails', () => {
  const baseInput: GuardrailInput = {
    action: 'respond',
    draft: 'Thank you for the offer.',
    dealerState: 'SC',
    channel: 'email',
    hasOptedInToText: false,
    hasTextedBefore: false,
    fairOtd: 30000,
    currentOfferOtd: 31000,
    pushbackCount: 0,
    shopperFirst: 'Maya',
  };

  describe('no cold texts rule', () => {
    it('blocks SMS when dealer has not opted in or texted before', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'sms',
        hasOptedInToText: false,
        hasTextedBefore: false,
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_cold_texts'));
    });

    it('allows SMS when dealer has opted in', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'sms',
        hasOptedInToText: true,
        hasTextedBefore: false,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noColdTexts, true);
    });

    it('allows SMS when dealer has texted before', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'sms',
        hasOptedInToText: false,
        hasTextedBefore: true,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noColdTexts, true);
    });

    it('always allows email', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'email',
        hasOptedInToText: false,
        hasTextedBefore: false,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noColdTexts, true);
    });

    it('always allows calls (California NOT paused per spec)', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'call',
        dealerState: 'CA',
        hasOptedInToText: false,
        hasTextedBefore: false,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noColdTexts, true);
    });
  });

  describe('no tax contest rule', () => {
    it('blocks drafts that contest taxes', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'We think the taxes are too high and should be reduced.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('blocks drafts that contest title fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Can you waive the title fee?',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('blocks drafts that contest registration fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'The registration fee seems excessive.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('blocks drafts that contest doc fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Can you reduce the doc fee?',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('allows normal pricing discussions', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Can you do better on the vehicle price?',
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noTaxContest, true);
    });
  });

  describe('max pushbacks rule', () => {
    it('blocks counter action when pushback count is 2 or more', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'counter',
        pushbackCount: 2,
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('max_pushbacks_exceeded'));
    });

    it('allows counter action when pushback count is less than 2', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'counter',
        pushbackCount: 1,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.maxPushbacks, true);
    });

    it('allows non-counter actions regardless of pushback count', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'accept',
        pushbackCount: 5,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.maxPushbacks, true);
    });
  });

  describe('OTD threshold rule', () => {
    it('blocks counter when offer is below threshold (default: greater of $500 or 1.5%)', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'counter',
        fairOtd: 30000,
        currentOfferOtd: 30400,
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('otd_below_threshold'));
    });

    it('allows counter when offer exceeds threshold', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'counter',
        fairOtd: 30000,
        currentOfferOtd: 30600,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.otdThreshold, true);
    });

    it('allows counter when fairOtd is unknown', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'counter',
        fairOtd: null,
        currentOfferOtd: 30000,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.otdThreshold, true);
    });

    it('allows counter when currentOfferOtd is unknown', () => {
      const input: GuardrailInput = {
        ...baseInput,
        action: 'counter',
        fairOtd: 30000,
        currentOfferOtd: null,
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.otdThreshold, true);
    });
  });

  describe('no shopper contact info rule', () => {
    it('blocks drafts containing phone numbers', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'You can reach Maya at 555-123-4567.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('shopper_contact_info_leaked'));
    });

    it('blocks drafts containing email addresses', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Contact Maya at maya@example.com.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('shopper_contact_info_leaked'));
    });

    it('allows drafts with first name only', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Maya is interested in the vehicle.',
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noShopperContactInfo, true);
    });

    it('allows drafts without any personal info', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Thank you for the offer. We will review and respond shortly.',
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noShopperContactInfo, true);
    });
  });

  describe('multiple violations', () => {
    it('reports all violations when multiple rules are broken', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'sms',
        hasOptedInToText: false,
        hasTextedBefore: false,
        action: 'counter',
        pushbackCount: 3,
        draft: 'Maya Smith can be reached at 555-123-4567. The taxes are too high.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_cold_texts'));
      assert.ok(result.violations.includes('no_tax_contest'));
      assert.ok(result.violations.includes('max_pushbacks_exceeded'));
      assert.ok(result.violations.includes('shopper_contact_info_leaked'));
    });
  });
});

describe('checkOtdThreshold', () => {
  it('uses 1.5% when it is greater than $500', () => {
    const passed = checkOtdThreshold('counter', 40000, 40600);
    assert.equal(passed, true);

    const failed = checkOtdThreshold('counter', 40000, 40500);
    assert.equal(failed, false);
  });

  it('uses $500 when it is greater than 1.5%', () => {
    const passed = checkOtdThreshold('counter', 20000, 20500);
    assert.equal(passed, true);

    const failed = checkOtdThreshold('counter', 20000, 20400);
    assert.equal(failed, false);
  });
});

describe('computeOtdThreshold', () => {
  it('returns $500 for low-priced vehicles', () => {
    const threshold = computeOtdThreshold(20000);
    assert.equal(threshold, 500);
  });

  it('returns 1.5% for high-priced vehicles', () => {
    const threshold = computeOtdThreshold(50000);
    assert.equal(threshold, 750);
  });

  it('returns $500 at the crossover point ($33,333)', () => {
    const threshold = computeOtdThreshold(33333);
    assert.equal(threshold, 500);
  });

  it('returns 1.5% above the crossover point', () => {
    const threshold = computeOtdThreshold(33334);
    assert.ok(threshold > 500);
  });
});

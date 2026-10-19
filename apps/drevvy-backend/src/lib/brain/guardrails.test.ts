import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runGuardrails,
  checkOtdThreshold,
  computeOtdThreshold,
  applyPlaybookRules,
  getAiDisclosure,
  getPriceFirstResponse,
  CALL_OPENER,
  type GuardrailInput,
} from './guardrails';

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

    it('blocks SMS when the dealer opted in but has not texted first', () => {
      const input: GuardrailInput = {
        ...baseInput,
        channel: 'sms',
        hasOptedInToText: true,
        hasTextedBefore: false,
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.equal(result.checks.noColdTexts, false);
      assert.ok(result.violations.includes('no_cold_texts'));
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
    it('blocks drafts that contest tax amounts', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'The taxes are too high, can you reduce them?',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('blocks drafts that contest title fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'We want to remove the title fee from the deal.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('blocks drafts that contest registration fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'The registration fee is excessive and unfair.',
      };
      const result = runGuardrails(input);
      assert.equal(result.blocked, true);
      assert.ok(result.violations.includes('no_tax_contest'));
    });

    it('allows discussing doc fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'Can you reduce the doc fee?',
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noTaxContest, true);
    });

    it('allows discussing destination fees', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'What is the destination fee on this vehicle?',
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noTaxContest, true);
    });

    it('allows plain mentions of tax', () => {
      const input: GuardrailInput = {
        ...baseInput,
        draft: 'What are the taxes on this vehicle?',
      };
      const result = runGuardrails(input);
      assert.equal(result.checks.noTaxContest, true);
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

describe('applyPlaybookRules', () => {
  it('escalates when fair OTD is unknown', () => {
    const result = applyPlaybookRules({
      fairOtd: null,
      currentOfferOtd: 30000,
      isItemized: true,
      dealerMessage: 'Here is our best price.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'escalate_to_human');
    assert.ok(result.reason.includes('unknown'));
  });

  it('presents to shopper when $750+ under fair', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: 31000,
      isItemized: true,
      dealerMessage: 'Here is our price.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'present_to_shopper');
    assert.ok(result.reason.includes('1,000'));
  });

  it('requests itemization when price is not itemized', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: 31500,
      isItemized: false,
      dealerMessage: 'Here is our price.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'request_itemization');
  });

  it('responds price-first when dealer says come in', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'Have the buyer come in to discuss.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'price_first_response');
    assert.ok(result.reason.includes('come in'));
  });

  it('responds price-first when dealer asks for buyer contact', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'Can I get the buyer\'s phone number?',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'price_first_response');
    assert.ok(result.reason.includes('contact'));
  });

  it('answers a deposit demand before numbers and shares registration for tax', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'I need a deposit before I can send numbers.',
      shopperFirst: 'Maya',
      registrationState: 'sc',
      registrationZip: '29401',
    });
    assert.equal(result.action, 'deposit_before_numbers');
    if (result.action !== 'deposit_before_numbers') return;
    assert.match(result.draft, /Maya isn't collecting quotes to forward/);
    assert.match(result.draft, /ready to move forward if the itemized out-the-door price works/);
    assert.match(result.draft, /SC, ZIP 29401/);
    assert.equal(/negotiat/i.test(result.draft), false);
  });

  it('keeps the honest AI sentence ahead of a deposit demand', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'Are you a bot? Also send a deposit first.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'honest_ai_disclosure');
  });

  it('asks for a VIN-tied written quote once the price is agreed', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: 31800,
      isItemized: true,
      dealerMessage: 'The price is agreed.',
      shopperFirst: 'Maya',
      vin: '1hgcv1f16na000123',
    });
    assert.equal(result.action, 'request_written_quote');
    if (result.action !== 'request_written_quote') return;
    assert.match(result.draft, /written quote tied to VIN 1HGCV1F16NA000123/);
  });

  it('labels a warranty answer as dealer-stated', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'It is still under warranty until June.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'confirm_dealer_stated');
    if (result.action !== 'confirm_dealer_stated') return;
    assert.match(result.draft, /pass it to Maya as dealer-stated/);
    assert.match(result.shopperNote ?? '', /^Dealer-stated: /);
  });

  it('asks for cash and outside-financing prices before a dealer-financing discount', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'That discount is only if you finance with us at 4.9%.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'cash_otd_first');
    if (result.action !== 'cash_otd_first') return;
    assert.match(result.draft, /cash and outside-financing out-the-door prices first/);
    assert.match(result.reason, /APR 4\.9%/);
  });

  it('thanks a clean itemized breakdown without overriding a come-in request', () => {
    const thanks = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: 32500,
      isItemized: true,
      dealerMessage: 'Vehicle $28,000, doc $499, tax $1,800, title $75.',
      shopperFirst: 'Maya',
    });
    assert.equal(thanks.action, 'thank_itemized');
    const comeIn = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'Come in and I will show doc $499 and tax $1,800.',
      shopperFirst: 'Maya',
    });
    assert.equal(comeIn.action, 'price_first_response');
  });

  it('offers email or text when a caller refuses an AI', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: "I won't talk to a bot.",
      shopperFirst: 'Maya',
      channel: 'call',
    });
    assert.equal(result.action, 'ai_refusal_fallback');
    if (result.action !== 'ai_refusal_fallback') return;
    assert.equal(result.draft, 'Understood. We can continue by email or text instead.');
  });

  it('continues when no special rule triggered', () => {
    const result = applyPlaybookRules({
      fairOtd: 32000,
      currentOfferOtd: 32500,
      isItemized: true,
      dealerMessage: 'Let me check with my manager.',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'continue');
  });
});

describe('getAiDisclosure', () => {
  it('includes the shopper first name', () => {
    const disclosure = getAiDisclosure('Maya');
    assert.ok(disclosure.includes('Maya'));
    assert.ok(disclosure.includes("Drevvy's AI"));
  });
});

describe('getPriceFirstResponse', () => {
  it('returns the price-first message', () => {
    const response = getPriceFirstResponse();
    assert.ok(response.includes('Price first'));
    assert.ok(response.includes('happy to set that up'));
  });
});

describe('CALL_OPENER', () => {
  it('includes recording disclosure', () => {
    assert.ok(CALL_OPENER.includes('recorded'));
  });

  it('includes placeholder for first name', () => {
    assert.ok(CALL_OPENER.includes('{first}'));
  });

  it('introduces Drevvy in a short hello', () => {
    assert.equal(CALL_OPENER.startsWith('Hi, this is Drevvy, working for {first}.'), true);
    assert.equal(/i'm an ai|i'm drevvy's ai/i.test(CALL_OPENER), false);
  });
});

describe('AI honesty', () => {
  const baseInput: GuardrailInput = {
    action: 'respond',
    draft: 'Thank you for the offer.',
    dealerState: 'SC',
    channel: 'email',
    hasOptedInToText: true,
    hasTextedBefore: true,
    fairOtd: 30000,
    currentOfferOtd: 31000,
    pushbackCount: 0,
    shopperFirst: 'Maya',
  };

  it('answers a sincere bot question with the honest sentence', () => {
    const result = applyPlaybookRules({
      fairOtd: null,
      currentOfferOtd: null,
      isItemized: false,
      dealerMessage: 'Are you a bot or a real person?',
      shopperFirst: 'Maya',
    });
    assert.equal(result.action, 'honest_ai_disclosure');
    const disclosure = getAiDisclosure('Maya');
    assert.equal(disclosure, "I'm Drevvy's AI, working for Maya.");
    const guard = runGuardrails({
      ...baseInput,
      draft: disclosure,
      dealerMessage: 'Are you a bot or a real person?',
    });
    assert.equal(guard.blocked, false);
    assert.equal(guard.checks.noLeadingAi, true);
    assert.equal(guard.checks.noAiDenial, true);
    assert.equal(guard.checks.noNegotiateWord, true);
  });

  it('blocks an opening that leads with being an AI', () => {
    const guard = runGuardrails({
      ...baseInput,
      draft: "I'm an AI working for Maya. What's your out-the-door price?",
      dealerMessage: 'Can you send the out-the-door price?',
    });
    assert.equal(guard.blocked, true);
    assert.ok(guard.violations.includes('led_with_ai'));
  });

  it('allows the short opener', () => {
    const guard = runGuardrails({
      ...baseInput,
      draft: "Hi, this is Drevvy, working for Maya. What's your out-the-door price?",
      dealerMessage: 'Can you send the out-the-door price?',
    });
    assert.equal(guard.checks.noLeadingAi, true);
    assert.equal(guard.checks.noAiDenial, true);
    assert.equal(guard.blocked, false);
  });

  it('blocks a denial and a claim to be human', () => {
    const denial = runGuardrails({
      ...baseInput,
      draft: "I'm not a bot. I'm a real person.",
      dealerMessage: 'Are you an AI?',
    });
    assert.equal(denial.blocked, true);
    assert.ok(denial.violations.includes('ai_denial'));
  });
});

describe('no automated assistant rule', () => {
  const baseInput: GuardrailInput = {
    action: 'respond',
    draft: 'Thank you for the offer.',
    dealerState: 'SC',
    channel: 'email',
    hasOptedInToText: true,
    hasTextedBefore: true,
    fairOtd: 30000,
    currentOfferOtd: 31000,
    pushbackCount: 0,
    shopperFirst: 'Maya',
  };

  it('blocks drafts containing "automated assistant"', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'Hello, I am an automated assistant here to help you.',
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('automated_assistant_phrase'));
  });

  it('blocks case-insensitive variations', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'This is an AUTOMATED ASSISTANT responding to your message.',
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('automated_assistant_phrase'));
  });

  it('allows drafts without the phrase', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'Thanks, I will pass that along.',
    };
    const result = runGuardrails(input);
    assert.equal(result.checks.noAutomatedAssistant, true);
  });

  it('allows similar phrases that are not exact match', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'Our automated system is helping to process your request.',
    };
    const result = runGuardrails(input);
    assert.equal(result.checks.noAutomatedAssistant, true);
  });
});

describe('no negotiate word rule', () => {
  const baseInput: GuardrailInput = {
    action: 'respond',
    draft: 'Thank you for the offer.',
    dealerState: 'SC',
    channel: 'email',
    hasOptedInToText: true,
    hasTextedBefore: true,
    fairOtd: 30000,
    currentOfferOtd: 31000,
    pushbackCount: 0,
    shopperFirst: 'Maya',
  };

  it('blocks drafts containing "negotiate"', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'We would like to negotiate the price.',
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('negotiate_word_used'));
  });

  it('blocks a draft that accepts for the shopper', () => {
    const result = runGuardrails({
      ...baseInput,
      action: 'accept',
      draft: 'I accept the offer for Maya.',
    });
    assert.equal(result.blocked, true);
    assert.equal(result.checks.noAcceptForShopper, false);
    assert.ok(result.violations.includes('accepted_for_shopper'));
  });

  it('blocks drafts containing "negotiating"', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'We are negotiating on behalf of the buyer.',
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('negotiate_word_used'));
  });

  it('blocks drafts containing "negotiation"', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'This negotiation is ongoing.',
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('negotiate_word_used'));
  });

  it('blocks case-insensitive variations', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'We need to NEGOTIATE on this price.',
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('negotiate_word_used'));
  });

  it('allows drafts without negotiate words', () => {
    const input: GuardrailInput = {
      ...baseInput,
      draft: 'We would like to discuss the price.',
    };
    const result = runGuardrails(input);
    assert.equal(result.checks.noNegotiateWord, true);
  });
});

describe('fair OTD known for counter rule', () => {
  const baseInput: GuardrailInput = {
    action: 'respond',
    draft: 'Thank you for the offer.',
    dealerState: 'SC',
    channel: 'email',
    hasOptedInToText: true,
    hasTextedBefore: true,
    fairOtd: 30000,
    currentOfferOtd: 31000,
    pushbackCount: 0,
    shopperFirst: 'Maya',
  };

  it('blocks counter when fair OTD is null', () => {
    const input: GuardrailInput = {
      ...baseInput,
      action: 'counter',
      fairOtd: null,
    };
    const result = runGuardrails(input);
    assert.equal(result.blocked, true);
    assert.ok(result.violations.includes('fair_otd_unknown_for_counter'));
  });

  it('allows counter when fair OTD is known', () => {
    const input: GuardrailInput = {
      ...baseInput,
      action: 'counter',
      fairOtd: 30000,
    };
    const result = runGuardrails(input);
    assert.equal(result.checks.fairOtdKnownForCounter, true);
  });

  it('allows non-counter actions when fair OTD is null', () => {
    const input: GuardrailInput = {
      ...baseInput,
      action: 'accept',
      fairOtd: null,
    };
    const result = runGuardrails(input);
    assert.equal(result.checks.fairOtdKnownForCounter, true);
  });

  it('allows clarify action when fair OTD is null', () => {
    const input: GuardrailInput = {
      ...baseInput,
      action: 'clarify',
      fairOtd: null,
    };
    const result = runGuardrails(input);
    assert.equal(result.checks.fairOtdKnownForCounter, true);
  });
});

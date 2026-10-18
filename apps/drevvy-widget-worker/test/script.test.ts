import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { dealerAskedForShopperContact, dealerAskedIfBot, sharesDisallowedContact } from '../src/widgets/guards';
import { isExactScriptMessage, renderScript } from '../src/widgets/script';
import { resolveNextMessage } from '../src/chat/resolve';

const script = renderScript({
  stockNumber: 'H24118',
  drevvyTextNumber: '803-555-0148',
  drevvyEmail: 'deals@drevvy.test',
  shopperFirst: 'Maya',
});

describe('chat script', () => {
  it('uses the fixed lines', () => {
    assert.equal(script.availability, 'Hi, this is Drevvy, working for Maya. Is this unit still available? Stock #H24118');
    assert.equal(/i'm an ai|i'm drevvy's ai/i.test(script.availability), false);
    assert.equal(script.listing_price, 'What is the listing price?');
    assert.equal(
      script.continue_offline,
      "Thanks. I'd like to continue over text and email, please reach us at 803-555-0148 or deals@drevvy.test.",
    );
    assert.equal(script.bot_disclosure, "I'm Drevvy's AI, working for Maya.");
    assert.equal(isExactScriptMessage(script.availability, script), true);
    assert.equal(isExactScriptMessage('Hi, this is Maya.', script), false);
  });

  it('asks the price after an available reply even if the model picks the handoff', () => {
    const next = resolveNextMessage({
      classification: { status: 'available', price: null, next_message: 'continue_offline' },
      dealerText: 'Yes, this unit is still available.',
      sent: new Set(['availability']),
    });
    assert.equal(next, 'listing_price');
  });

  it('does not continue after a sold reply', () => {
    const next = resolveNextMessage({
      classification: { status: 'sold', price: null, next_message: 'listing_price' },
      dealerText: 'Sorry, that one sold yesterday.',
      sent: new Set(['availability']),
    });
    assert.equal(next, null);
  });

  it('discloses the bot and then stops when the shopper is asked for a phone', () => {
    assert.equal(dealerAskedIfBot('Are you a bot?'), true);
    assert.equal(dealerAskedIfBot('Yes, this unit is still available.'), false);
    assert.equal(
      resolveNextMessage({
        classification: { status: 'unknown', price: null, next_message: 'none' },
        dealerText: 'Are you a bot?',
        sent: new Set(['availability']),
      }),
      'bot_disclosure',
    );
    assert.equal(dealerAskedForShopperContact('Can I get your phone number?'), true);
    assert.equal(
      resolveNextMessage({
        classification: { status: 'price_given', price: '$24,995', next_message: 'continue_offline' },
        dealerText: 'Can I get your phone number?',
        sent: new Set(['availability']),
      }),
      null,
    );
  });

  it('blocks a message that adds a shopper phone or email', () => {
    const allowed = { drevvyTextNumber: '803-555-0148', drevvyEmail: 'deals@drevvy.test' };
    assert.equal(sharesDisallowedContact(script.continue_offline, allowed), false);
    assert.equal(sharesDisallowedContact('Reach the shopper at 212-555-0199.', allowed), true);
    assert.equal(sharesDisallowedContact('Email maya.shopper@example.test', allowed), true);
  });

  it('keeps the honesty answer and does not say negotiate', () => {
    assert.equal(script.bot_disclosure, "I'm Drevvy's AI, working for Maya.");
    const sources = ['widgets/script.ts', 'chat/agent.ts', 'forms/outreach.ts'].map((file) =>
      readFileSync(path.join(__dirname, '../src', file), 'utf8'),
    );
    for (const source of sources) assert.equal(/negotiat/i.test(source), false);
    assert.match(sources[0] ?? '', /I'm Drevvy's AI, working for/);
  });
});

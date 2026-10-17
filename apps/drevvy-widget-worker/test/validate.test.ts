import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseHintsFile } from '../src/research/hints';
import {
  groundEmails,
  groundName,
  groundPhones,
  normalizeEmail,
  normalizePhone,
  normalizePrice,
} from '../src/research/validate';

const html = '<a href="tel:+18035550199">(803) 555-0199</a> sales@example-motors.test Example Motors';

describe('contact validation', () => {
  it('normalizes US phones and emails', () => {
    assert.equal(normalizePhone('(803) 555-0199'), '+18035550199');
    assert.equal(normalizePhone('555-0199'), null);
    assert.equal(normalizePhone('123-555-0199'), null);
    assert.equal(normalizeEmail(' Sales@Example-Motors.TEST '), 'sales@example-motors.test');
    assert.equal(normalizeEmail('not-an-email'), null);
  });

  it('keeps only phones and emails that appear on the page', () => {
    assert.deepEqual(groundPhones(['803-555-0199', '803-555-0177', 'nope'], html), ['+18035550199']);
    assert.deepEqual(groundEmails(['sales@example-motors.test', 'hint@marketcheck.test'], html), [
      'sales@example-motors.test',
    ]);
    assert.equal(groundName('Hint Motors', html), null);
    assert.equal(groundName('Example Motors', html), 'Example Motors');
  });

  it('reads a listing price and drops a non-price', () => {
    assert.equal(normalizePrice('the price is $24,995'), '$24,995');
    assert.equal(normalizePrice('yes'), null);
    assert.equal(normalizePrice('$12'), null);
  });

  it('drops MarketCheck listing fields from a hints file', () => {
    const hints = parseHintsFile(
      JSON.stringify({
        'https://www.example-motors.test/inventory/civic': {
          dealerName: 'Hint Motors',
          phone: '8035550177',
          email: 'hint@marketcheck.test',
          vin: '1HGCV1F16NA000001',
          price: 24995,
          raw: { id: 'mc-1' },
        },
      }),
    );
    const hint = hints['https://www.example-motors.test/inventory/civic'];
    assert.deepEqual(hint, {
      dealerName: 'Hint Motors',
      phone: '8035550177',
      email: 'hint@marketcheck.test',
    });
    assert.equal(JSON.stringify(hint).includes('1HGCV1F16NA000001'), false);
  });
});

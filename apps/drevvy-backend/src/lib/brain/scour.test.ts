import assert from 'node:assert/strict';
import test from 'node:test';

import { acceptsForShopper, labelDealerStated, readFinancingQuote, scourReply } from './scour';

const base = {
  shopperFirst: 'Maya',
  channel: 'email' as const,
  dealerMessage: '',
};

test('a deposit demand stays partner-style and includes registration for tax', () => {
  const reply = scourReply({
    ...base,
    dealerMessage: 'Put down a deposit before I run numbers.',
    registrationState: 'NC',
    registrationZip: '28202',
  });
  assert.equal(reply?.action, 'deposit_before_numbers');
  assert.match(reply?.draft ?? '', /Maya isn't collecting quotes to forward/);
  assert.match(reply?.draft ?? '', /NC, ZIP 28202/);
  assert.equal(scourReply({ ...base, dealerMessage: 'No deposit required.' }), null);
});

test('both out-the-door numbers and the rate are recorded when financing is required', () => {
  const message = 'Cash is $32,400. The discount is only if you finance with us: $30,900 at 3.9%.';
  const quote = readFinancingQuote(message);
  assert.deepEqual(quote, { cashOtd: 32400, financedOtd: 30900, apr: 3.9 });
  const reply = scourReply({ ...base, dealerMessage: message });
  assert.equal(reply?.action, 'cash_otd_first');
  assert.equal(reply?.draft, 'Thanks, both out-the-door prices and the rate are clear.');
  assert.match(reply?.reason ?? '', /cash OTD 32400/);
  assert.match(reply?.reason ?? '', /financed OTD 30900/);
  assert.match(reply?.reason ?? '', /APR 3\.9%/);
});

test('an agreed price asks for a written quote tied to the VIN', () => {
  const reply = scourReply({
    ...base,
    dealerMessage: 'We are agreed on the price.',
    vin: '1hgcm82633a004352',
  });
  assert.match(reply?.draft ?? '', /VIN 1HGCM82633A004352/);
  assert.equal(scourReply({
    ...base,
    dealerMessage: 'We are agreed on the price.',
    vin: '1hgcm82633a004352',
    writtenQuoteRequested: true,
  }), null);
});

test('spec answers are labeled dealer-stated and a clean breakdown gets a short thanks', () => {
  const note = labelDealerStated('  Certified pre-owned, one owner.  ');
  assert.equal(note, 'Dealer-stated: Certified pre-owned, one owner.');
  const spec = scourReply({ ...base, dealerMessage: 'It is certified pre-owned.' });
  assert.equal(spec?.shopperNote, 'Dealer-stated: It is certified pre-owned.');
  const thanks = scourReply({
    ...base,
    dealerMessage: 'Doc $599, tax $1,760, title $56, registration $180.',
  });
  assert.equal(thanks?.draft, 'Thanks, this breakdown is clear.');
});

test('a caller who refuses an AI gets email or text, and Drevvy never accepts for the shopper', () => {
  const call = scourReply({
    ...base,
    channel: 'call',
    dealerMessage: 'I do not talk to AI.',
  });
  assert.equal(call?.draft, 'Understood. We can continue by email or text instead.');
  assert.equal(scourReply({ ...base, dealerMessage: 'I do not talk to AI.' }), null);
  assert.equal(acceptsForShopper("I'll accept the offer."), true);
  assert.equal(acceptsForShopper('Thanks, this breakdown is clear.'), false);
});

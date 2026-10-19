import assert from 'node:assert/strict';
import test from 'node:test';

import { computeOtd, emptyQuote, type SourcedAmount } from './quote';

function sourced(amount: number): SourcedAmount {
  return { amount, source_snippet: `$${amount}`, message_ref: 'dealer_message' };
}

test('code sums the lines and does not copy a dealer total', () => {
  const quote = emptyQuote();
  quote.vehicle_price = sourced(27400);
  quote.doc_fee = sourced(699);
  quote.tax = sourced(1644);
  quote.title_fee = sourced(85);
  quote.registration_fee = sourced(120);
  quote.dealer_stated_otd = sourced(29948);

  const otd = computeOtd(quote);
  assert.equal(otd.computedOtd, 29948);
  assert.equal(otd.complete, true);
  assert.equal(otd.flags.length, 0);
});

test('a stated total with no lines is not treated as the computed total', () => {
  const quote = emptyQuote();
  quote.dealer_stated_otd = sourced(34000);
  const otd = computeOtd(quote);
  assert.equal(otd.computedOtd, null);
  assert.equal(otd.statedOtd, 34000);
  assert.equal(otd.complete, false);
  assert.ok(otd.flags.some((flag) => flag.code === 'missing_fee' && flag.field === 'vehicle_price'));
  assert.ok(otd.flags.some((flag) => flag.code === 'missing_fee' && flag.field === 'tax'));
});

test('missing fees and a total that ignores tax are flagged', () => {
  const quote = emptyQuote();
  quote.vehicle_price = sourced(30000);
  quote.tax = sourced(2100);
  quote.doc_fee = sourced(599);
  quote.dealer_stated_otd = sourced(30000);

  const otd = computeOtd(quote);
  assert.equal(otd.computedOtd, 32699);
  assert.equal(otd.complete, false);
  assert.ok(otd.flags.some((flag) => flag.code === 'missing_fee' && flag.field === 'title_fee'));
  assert.ok(otd.flags.some((flag) => flag.code === 'inconsistent_total' && flag.stated === 30000));
});

test('a negative fee is flagged and the quote is not complete', () => {
  const quote = emptyQuote();
  quote.vehicle_price = sourced(20000);
  quote.doc_fee = sourced(-10);
  quote.tax = sourced(1000);
  quote.title_fee = sourced(50);
  quote.registration_fee = sourced(80);
  const otd = computeOtd(quote);
  assert.equal(otd.complete, false);
  assert.ok(otd.flags.some((flag) => flag.code === 'invalid_amount' && flag.field === 'doc_fee'));
});

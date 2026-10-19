import assert from 'node:assert/strict';
import test from 'node:test';

import { routeDealerMessage } from './routing';

test('clear short replies stay on the fast model', () => {
  assert.equal(routeDealerMessage('STOP').lane, 'fast');
  assert.equal(routeDealerMessage('STOP').simpleClass, 'opt_out');
  assert.equal(routeDealerMessage('stop texting me bro').simpleClass, 'opt_out');
  assert.equal(routeDealerMessage('Quote attached.').simpleClass, 'quote_attached');
  assert.equal(routeDealerMessage('When can you come in?').simpleClass, 'come_in');
  assert.equal(routeDealerMessage("Come in and we'll talk. I can't do numbers over text.").simpleClass, 'come_in');
  assert.equal(routeDealerMessage("What's the customer's phone number?").simpleClass, 'contact_request');
  assert.equal(routeDealerMessage('k thanks').lane, 'fast');
});

test('fees, conflicts, and hedges go to the main model', () => {
  const fee = routeDealerMessage('Selling price $27,400, doc fee $699, tax $1,644, title $85, registration $120.');
  assert.equal(fee.lane, 'main');
  assert.ok(fee.reasons.includes('fee_heavy'));

  const conflict = routeDealerMessage('OTD is $31,200. Actually the total due at signing is $33,450.');
  assert.equal(conflict.lane, 'main');
  assert.ok(conflict.reasons.includes('conflicting'));

  const hedge = routeDealerMessage('$25,000 plus tax and title');
  assert.equal(hedge.lane, 'main');
  assert.ok(hedge.reasons.includes('ambiguous'));

  const slang = routeDealerMessage('yea we can do 32 racks OTD');
  assert.equal(slang.lane, 'main');
  assert.equal(routeDealerMessage('doc fee is five hundo, car is 25 grand').lane, 'main');
  assert.equal(routeDealerMessage('Quote attached. Bottom line $36,400 OTD.').lane, 'main');
});

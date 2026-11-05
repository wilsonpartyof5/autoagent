import assert from 'node:assert/strict';
import test from 'node:test';

import { isDuplicateDealerReply } from './reply-guard';

test('idempotency keeps a later distinct reply and a new turn', () => {
  const first = [{ author: 'salesperson', body: 'Yes, it is here.' }];
  const seen = new Set(['key-1']);
  assert.equal(isDuplicateDealerReply(first, 'Still here.', 'key-2', seen), false);
  assert.equal(isDuplicateDealerReply(first, 'A different sentence', 'key-1', seen), true);
  assert.equal(isDuplicateDealerReply(first, 'Yes, it is here.', null, seen), true);

  const afterShopper = [
    { author: 'salesperson', body: 'Yes, it is here.' },
    { author: 'drevvy', body: 'Warning 1 of 3' },
    { author: 'shopper', body: 'Thanks' },
  ];
  assert.equal(isDuplicateDealerReply(afterShopper, 'Yes, it is here.', 'key-3', seen), false);
  assert.equal(isDuplicateDealerReply(afterShopper, 'A new sentence.', 'key-3', seen), false);
});

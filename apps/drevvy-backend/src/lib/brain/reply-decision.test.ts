import assert from 'node:assert/strict';
import test from 'node:test';

import { REPLY_DECISION_PROMPT } from './reply-decision';

test('reply prompt opens short and saves the AI sentence for a direct question', () => {
  assert.match(REPLY_DECISION_PROMPT, /Hi, this is Drevvy, working for \{first\}\./);
  assert.match(REPLY_DECISION_PROMPT, /Do not lead with "I'm an AI"/);
  assert.match(REPLY_DECISION_PROMPT, /I'm Drevvy's AI, working for \{first\}\./);
  assert.match(REPLY_DECISION_PROMPT, /Never deny being an AI/);
  assert.match(REPLY_DECISION_PROMPT, /Never use the word "negotiate"/);
  assert.match(REPLY_DECISION_PROMPT, /Never share shopper contact info/);
  assert.equal(/Always identify yourself honestly/.test(REPLY_DECISION_PROMPT), false);
});

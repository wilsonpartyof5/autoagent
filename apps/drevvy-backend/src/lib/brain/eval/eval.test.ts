import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyQuote, type QuoteField } from '../quote';
import { EVAL_CASES } from './cases';
import { evalTargetsFromEnv } from './run-eval';
import { scoreProposal, summarizeScores } from './score';
import type { DealProposal } from '../proposal';

const ACTIONS = ['ask_for_itemization', 'request_fee_clarification', 'send_reply', 'wait', 'escalate'];

test('the harness has a labeled case for each failure mode', () => {
  assert.ok(EVAL_CASES.length >= 20);
  const blob = EVAL_CASES.map((item) => `${item.id} ${item.message} ${item.tags.join(' ')}`).join('\n');
  for (const needle of ['short', 'slang', 'incomplete', 'contradictory', 'doc', 'tax', 'come in', 'pressure', 'phone']) {
    assert.match(blob.toLowerCase(), new RegExp(needle));
  }
  for (const item of EVAL_CASES) {
    assert.equal(typeof item.message, 'string');
    assert.ok(item.message.trim().length > 0);
    assert.equal(typeof item.abstain, 'boolean');
    assert.ok(item.allowedAction.length > 0);
    for (const action of item.allowedAction) assert.ok(ACTIONS.includes(action));
    assert.equal(typeof item.expectedAmounts, 'object');
  }
});

test('fee accuracy, abstain, and policy violations score separately', () => {
  const itemized = EVAL_CASES.find((item) => item.id === 'itemized-doc-tax');
  assert.ok(itemized);
  const proposal = proposalFrom(itemized.expectedAmounts, 'send_reply', 'Thanks, this breakdown is clear.');
  const score = scoreProposal(itemized, proposal, { latencyMs: 40, costUsd: 0.01 });
  assert.equal(score.valid, true);
  assert.equal(score.feeAccuracy, 1);
  assert.deepEqual(score.policyViolations, []);

  const invented = proposalFrom({ ...itemized.expectedAmounts, addons: 695 }, 'send_reply', 'Thanks.');
  const abstainCase = EVAL_CASES.find((item) => item.id === 'incomplete-sticker');
  assert.ok(abstainCase);
  const abstainScore = scoreProposal(abstainCase, invented, { latencyMs: 10, costUsd: 0 });
  assert.ok(abstainScore.feeAccuracy < 1);

  const caved = proposalFrom({}, 'send_reply', "We'll take it.");
  const pressure = EVAL_CASES.find((item) => item.id === 'pressure-expires');
  assert.ok(pressure);
  const policy = scoreProposal(pressure, caved);
  assert.ok(policy.policyViolations.includes('caved_to_pressure'));

  const negotiate = proposalFrom({}, 'send_reply', 'Happy to negotiate.');
  const phone = EVAL_CASES.find((item) => item.id === 'phone-request');
  assert.ok(phone);
  const negotiateScore = scoreProposal(phone, negotiate);
  assert.ok(negotiateScore.policyViolations.includes('negotiate_word'));

  const invalid = scoreProposal(phone, null, { latencyMs: 40, costUsd: 0 });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.policyViolations.includes('invalid_proposal'));

  const report = summarizeScores('gpt-6-astra', [score, invalid]);
  assert.equal(report.validProposals, 1);
  assert.equal(report.cases, 2);
  assert.equal(report.latencyP50Ms, 40);
  assert.equal(report.costUsd, 0.01);
});

test('eval targets are astra, sol, and grok through the xAI base URL', () => {
  const targets = evalTargetsFromEnv({
    OPENAI_API_KEY: 'sk-test',
    XAI_API_KEY: 'xai-test',
  });
  assert.deepEqual(targets.map((target) => target.label), ['gpt-6-astra', 'gpt-6.1-sol', 'grok-4.7']);
  assert.equal(targets[0].model, 'gpt-6-astra');
  assert.equal(targets[0].role, 'main');
  assert.equal(targets[1].model, 'gpt-6.1-sol');
  assert.equal(targets[2].model, 'grok-4.7');
  assert.equal(targets[2].baseURL, 'https://api.x.ai/v1');
  assert.equal(targets[2].role, 'fallback');
});

function proposalFrom(
  amounts: Partial<Record<QuoteField, number | null>>,
  action: DealProposal['proposed_action'],
  draft: string,
): DealProposal {
  const quote = emptyQuote();
  for (const [field, amount] of Object.entries(amounts) as Array<[QuoteField, number | null]>) {
    quote[field] = {
      amount,
      source_snippet: amount == null ? null : String(amount),
      message_ref: 'dealer_message',
    };
  }
  return { proposed_action: action, draft, reasoning: 'eval fixture', quote };
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertChatConfig, assertOutreachConfig, isAllowlisted, loadConfig, resolveMaxTurns } from '../src/config';

describe('config', () => {
  it('keeps dry run on unless DRY_RUN is exactly false', () => {
    assert.equal(loadConfig({}).dryRun, true);
    assert.equal(loadConfig({ DRY_RUN: 'true' }).dryRun, true);
    assert.equal(loadConfig({ DRY_RUN: 'FALSE' }).dryRun, true);
    assert.equal(loadConfig({ DRY_RUN: 'false' }).dryRun, false);
  });

  it('caps the turn limit at 6', () => {
    assert.equal(resolveMaxTurns(undefined), 6);
    assert.equal(resolveMaxTurns('2'), 2);
    assert.equal(resolveMaxTurns('99'), 6);
    assert.equal(resolveMaxTurns('0'), 6);
  });

  it('matches allowlist hosts and rejects an empty list', () => {
    const page = 'https://www.example-motors.test/inventory/civic';
    assert.equal(isAllowlisted(page, []), false);
    assert.equal(isAllowlisted(page, ['https://other.test']), false);
    assert.equal(isAllowlisted(page, ['www.example-motors.test']), true);
    assert.equal(isAllowlisted(page, ['https://www.example-motors.test/inventory']), true);
  });

  it('defaults the lead last name and accepts a ZIP', () => {
    assert.equal(loadConfig({}).leadLastName, 'via Drevvy');
    assert.equal(loadConfig({}).leadZip, null);
    assert.equal(loadConfig({ DREVVY_ZIP: '29201' }).leadZip, '29201');
    assert.equal(loadConfig({ DREVVY_ZIP: '29201-1234' }).leadZip, '29201-1234');
    assert.equal(loadConfig({ DREVVY_ZIP: 'nope' }).leadZip, null);
    assert.equal(loadConfig({ LEAD_LAST_NAME: 'with Drevvy' }).leadLastName, 'with Drevvy');
  });

  it('refuses live chat without an allowlist', () => {
    const config = loadConfig({
      DRY_RUN: 'false',
      AI_API_KEY: 'key',
      AI_MODEL: 'grok-4',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      DREVVY_TEXT_NUMBER: '803-555-0148',
      DREVVY_EMAIL: 'deals@drevvy.test',
      SHOPPER_FIRST_NAME: 'Maya',
    });
    assert.throws(() => assertChatConfig(config, false), /ALLOWLIST/);
    const named = loadConfig({
      DRY_RUN: 'false',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      DREVVY_TEXT_NUMBER: '803-555-0148',
      DREVVY_EMAIL: 'deals@drevvy.test',
      SHOPPER_FIRST_NAME: 'Maya',
      LEAD_LAST_NAME: 'via 555',
      WIDGET_CHAT_ALLOWLIST: 'https://www.example-motors.test',
    });
    assert.throws(() => assertOutreachConfig(named, false), /LEAD_LAST_NAME/);
  });
});

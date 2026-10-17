import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertChatConfig, assertOutreachConfig, assertSeedConfig, chatSettings, isAllowlisted, loadConfig, resolveMaxTurns } from '../src/config';

describe('config', () => {
  it('keeps dry run on unless DRY_RUN is exactly false', () => {
    assert.equal(loadConfig({}).dryRun, true);
    assert.equal(loadConfig({ DRY_RUN: 'true' }).dryRun, true);
    assert.equal(loadConfig({ DRY_RUN: 'FALSE' }).dryRun, true);
    assert.equal(loadConfig({ DRY_RUN: 'false' }).dryRun, false);
    assert.equal(loadConfig({}).scanSettleMs, 3000);
    assert.equal(loadConfig({ WIDGET_SCAN_SETTLE_MS: '1500' }).scanSettleMs, 1500);
    assert.equal(loadConfig({}).scanConcurrency, 3);
    assert.equal(loadConfig({ WIDGET_SCAN_CONCURRENCY: '5' }).scanConcurrency, 5);
    assert.equal(loadConfig({}).scanTimeoutMs, 25000);
    assert.equal(loadConfig({ WIDGET_SCAN_TIMEOUT_MS: '20000' }).scanTimeoutMs, 20000);
    assert.equal(loadConfig({}).seedIntervalMs, 1000);
    assert.equal(loadConfig({ SEED_MIN_INTERVAL_MS: '0' }).seedIntervalMs, 0);
    assert.equal(loadConfig({ SEED_MIN_INTERVAL_MS: '-5' }).seedIntervalMs, 1000);
    assert.equal(loadConfig({}).marketcheckApiKey, null);
    assert.equal(loadConfig({ MARKETCHECK_API_KEY: 'mc-key' }).marketcheckApiKey, 'mc-key');
    assert.equal(loadConfig({}).marketcheckBaseUrl, 'https://api.marketcheck.com');
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

  it('keeps global contact variables as a test-mode fallback', () => {
    const live = loadConfig({
      DRY_RUN: 'false',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      WIDGET_CHAT_ALLOWLIST: 'https://www.example-motors.test',
    });
    assert.equal(live.testMode, false);
    assert.doesNotThrow(() => assertOutreachConfig(live, false));
    assert.throws(() => chatSettings(live), /conversation identity/);
    const testMode = loadConfig({
      DREVVY_TEST_MODE: '1',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });
    assert.equal(testMode.testMode, true);
    assert.throws(() => assertOutreachConfig(testMode, true), /DREVVY_TEXT_NUMBER/);
  });

  it('requires a MarketCheck key to seed', () => {
    const config = loadConfig({
      AI_API_KEY: 'key',
      AI_MODEL: 'grok-4',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });
    assert.throws(() => assertSeedConfig(config), /MARKETCHECK_API_KEY/);
    assert.doesNotThrow(() =>
      assertSeedConfig(
        loadConfig({
          AI_API_KEY: 'key',
          AI_MODEL: 'grok-4',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service',
          MARKETCHECK_API_KEY: 'mc-key',
        }),
      ),
    );
  });
});

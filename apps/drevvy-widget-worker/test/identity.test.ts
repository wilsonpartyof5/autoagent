import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chatSettings, loadConfig } from '../src/config';
import { preferConversationContact } from '../src/forms/identity';
import { outreachIdentity } from '../src/forms/outreach';

describe('conversation contact', () => {
  it('prefers the identity row over the test environment', () => {
    const resolved = preferConversationContact({
      contact: {
        shopperFirst: 'Luis',
        emailAlias: 'luis.ab12@offers.drevvy.com',
        smsNumber: '+18035550148',
      },
      testMode: true,
      env: {
        shopperFirst: 'Maya',
        email: 'deals@drevvy.test',
        textNumber: '212-555-0199',
      },
    });
    assert.deepEqual(resolved, {
      shopperFirst: 'Luis',
      email: 'luis.ab12@offers.drevvy.com',
      textNumber: '803-555-0148',
    });
    const filled = outreachIdentity({
      dryRun: true,
      allowlist: [],
      drevvyTextNumber: resolved && 'textNumber' in resolved ? resolved.textNumber : '',
      drevvyEmail: resolved && 'email' in resolved ? resolved.email : '',
      shopperFirst: resolved && 'shopperFirst' in resolved ? resolved.shopperFirst : '',
      leadLastName: 'via Drevvy',
    });
    assert.equal(filled.email, 'luis.ab12@offers.drevvy.com');
    assert.equal(filled.phone, '803-555-0148');
    assert.equal(filled.firstName, 'Luis');
    assert.equal(filled.email.includes('deal'), false);
  });

  it('refuses env contact unless test mode is on', () => {
    const config = loadConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      WIDGET_CHAT_ALLOWLIST: 'https://www.example-motors.test',
      DREVVY_TEXT_NUMBER: '803-555-0148',
      DREVVY_EMAIL: 'deals@drevvy.test',
      SHOPPER_FIRST_NAME: 'Maya',
    });
    assert.equal(config.testMode, false);
    assert.throws(() => chatSettings(config), /conversation identity/);
    const testConfig = loadConfig({
      DREVVY_TEST_MODE: 'true',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      DREVVY_TEXT_NUMBER: '803-555-0148',
      DREVVY_EMAIL: 'deals@drevvy.test',
      SHOPPER_FIRST_NAME: 'Maya',
    });
    const settings = chatSettings(testConfig);
    assert.equal(settings.drevvyEmail, 'deals@drevvy.test');
    assert.equal(settings.shopperFirst, 'Maya');
  });
});

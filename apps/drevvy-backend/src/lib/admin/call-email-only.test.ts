import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { presentCallEmailDealers } from './call-email-only';

const HERE = __dirname;

test('call/email only dealers are the flagged directory rows', () => {
  const dealers = presentCallEmailDealers([
    { site_url: 'https://b.example', name: 'Beta Motors', widget_vendor: 'matador', call_email_only: true },
    { site_url: 'https://a.example', name: '  ', widget_vendor: '', call_email_only: true },
    { site_url: 'https://c.example', name: 'Kept', widget_vendor: 'gubagoo', call_email_only: false },
  ]);
  assert.deepEqual(dealers, [
    { siteUrl: 'https://b.example', name: 'Beta Motors', widgetVendor: 'matador' },
    { siteUrl: 'https://a.example', name: null, widgetVendor: null },
  ]);
});

test('the Outreach tab shows the call/email only list and does not say negotiate', () => {
  const page = readFileSync(path.join(HERE, '../../app/admin/outreach/page.tsx'), 'utf8');
  const panel = readFileSync(path.join(HERE, '../../components/admin/call-email-only.tsx'), 'utf8');
  assert.match(page, /CallEmailOnlyPanel/);
  assert.match(page, /loadCallEmailOnlyDealers/);
  assert.match(panel, /widget channel is skipped/);
  assert.equal(/negotiat/i.test(`${page}\n${panel}`), false);
});

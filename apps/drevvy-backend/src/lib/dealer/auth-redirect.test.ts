import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEALER_DESK_ORIGIN,
  DEALER_MAGIC_LINK_SUBJECT,
  DEALER_MAGIC_LINK_TEMPLATE,
  dealerAuthRedirectTo,
  dealerOtpType,
  marketingAuthCodeForwardUrl,
  marketingAuthCodeScript,
} from './auth-redirect';
import { demoDealerSession } from './demo-session';
import { loadDeskAnalytics, loadDeskInbox } from './desk-data';

const HERE = dirname(fileURLToPath(import.meta.url));

test('dealer OTP redirect stays on the desk host', () => {
  assert.equal(
    dealerAuthRedirectTo('https://admin.drevvy.com'),
    'https://admin.drevvy.com/dealer/auth/callback',
  );
  assert.equal(
    dealerAuthRedirectTo('https://admin.drevvy.com/dealer/login?next=/dealer/inbox'),
    'https://admin.drevvy.com/dealer/auth/callback',
  );
  assert.equal(
    dealerAuthRedirectTo('http://localhost:3000'),
    'http://localhost:3000/dealer/auth/callback',
  );
  assert.equal(dealerAuthRedirectTo('https://www.drevvy.com'), null);
  assert.equal(dealerAuthRedirectTo('https://drevvy.com'), null);
  assert.equal(dealerAuthRedirectTo('http://admin.drevvy.com'), null);
  assert.equal(dealerAuthRedirectTo('javascript:alert(1)'), null);
  assert.equal(dealerAuthRedirectTo('https://admin.drevvy.com.evil.com'), null);
});

test('a marketing homepage PKCE code is forwarded to the dealer callback', () => {
  const code = '11111111-2222-4333-8444-555555555555';
  assert.equal(
    marketingAuthCodeForwardUrl('www.drevvy.com', '/', code),
    `${DEALER_DESK_ORIGIN}/dealer/auth/callback?code=${code}`,
  );
  assert.equal(
    marketingAuthCodeForwardUrl('drevvy.com:443', '/', code),
    `${DEALER_DESK_ORIGIN}/dealer/auth/callback?code=${encodeURIComponent(code)}`,
  );
  assert.equal(marketingAuthCodeForwardUrl('admin.drevvy.com', '/', code), null);
  assert.equal(marketingAuthCodeForwardUrl('www.drevvy.com', '/dealers', code), null);
  assert.equal(marketingAuthCodeForwardUrl('www.drevvy.com', '/', 'short'), null);
  assert.equal(marketingAuthCodeForwardUrl('www.drevvy.com', '/', 'code with spaces'), null);
  const script = marketingAuthCodeScript();
  assert.match(script, /admin\.drevvy\.com\/dealer\/auth\/callback/);
  assert.equal(script.includes('www.drevvy.com/?code'), false);
});

test('hosted magic-link template carries the 6-digit token and the confirmation link', () => {
  assert.equal(DEALER_MAGIC_LINK_SUBJECT, 'Your Drevvy sign-in code');
  assert.match(DEALER_MAGIC_LINK_TEMPLATE, /\{\{ \.Token \}\}/);
  assert.match(DEALER_MAGIC_LINK_TEMPLATE, /\{\{ \.ConfirmationURL \}\}/);
  assert.equal(DEALER_MAGIC_LINK_TEMPLATE.includes('www.drevvy.com'), false);
  assert.equal(dealerOtpType('email'), 'email');
  assert.equal(dealerOtpType('magiclink'), 'magiclink');
  assert.equal(dealerOtpType('recovery'), null);
});

test('login, callback, and terms wire the session handoff', () => {
  const login = readFileSync(join(HERE, '../../components/dealer/login-form.tsx'), 'utf8');
  const callback = readFileSync(join(HERE, '../../app/dealer/auth/callback/route.ts'), 'utf8');
  const terms = readFileSync(join(HERE, '../../app/dealer/onboarding/terms/page.tsx'), 'utf8');
  const actions = readFileSync(join(HERE, '../../app/dealer/actions.ts'), 'utf8');
  const layout = readFileSync(join(HERE, '../../app/layout.tsx'), 'utf8');

  assert.match(login, /dealerAuthRedirectTo\(window\.location\.origin\)/);
  assert.match(login, /emailRedirectTo/);
  assert.match(login, /redirect\/i/);
  assert.match(login, /verifyOtp/);
  assert.equal(login.includes('www.drevvy.com'), false);

  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /\/dealer\/inbox/);
  assert.equal(callback.includes('www.drevvy.com'), false);

  assert.match(terms, /acceptDemoOnboarding/);
  assert.match(actions, /isLiveDealerSession/);
  assert.match(layout, /marketingAuthCodeScript/);
});

test('demo onboarding session opens inbox and analytics on the mock book', async () => {
  const session = demoDealerSession();
  const inbox = await loadDeskInbox(session);
  assert.equal(inbox.source, 'mock');
  assert.ok(inbox.items.some((item) => item.id === 'conv_tucson'));
  const analytics = await loadDeskAnalytics(session);
  assert.equal(analytics.length, 3);
  assert.ok(analytics.every((summary) => summary.source === 'mock'));
});

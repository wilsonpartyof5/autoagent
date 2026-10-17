import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runWidgetChat } from '../src/chat/agent';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { detectLeadForms, detectPrechat } from '../src/forms/detect';
import { runLeadForm } from '../src/forms/lead';
import { leadMessage } from '../src/forms/outreach';
import { planForm } from '../src/forms/plan';
import { extractWidgetScope } from '../src/widgets/vendors';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const shopperPhone = '212-555-0198';
const shopperEmail = 'shopper@example.com';
const message = leadMessage({
  stockNumber: 'H24118',
  phone: '803-555-0148',
  email: 'deals@drevvy.test',
});

const live = {
  dryRun: false,
  allowlist: ['https://www.example-motors.test'],
  drevvyTextNumber: '803-555-0148',
  drevvyEmail: 'deals@drevvy.test',
  shopperFirst: 'Maya',
  leadLastName: 'via Drevvy',
  leadZip: '29201',
};

function filled(page: FakeChatPage): Record<string, string> {
  return Object.fromEntries(page.outreach.map((fill) => [fill.kind, fill.value]));
}

describe('lead forms', () => {
  it('fills Check Availability with Drevvy contact details and the script message', async () => {
    const page = new FakeChatPage(readFixture('check-availability.html'));
    const store = new MemoryAttemptStore();
    const result = await runLeadForm({ vehiclePageUrl: pageUrl, page, config: live, store });

    assert.equal(result.status, 'submitted');
    assert.equal(result.channel, 'lead_form');
    assert.equal(result.stockNumber, 'H24118');
    assert.deepEqual(filled(page), {
      first_name: 'Maya',
      last_name: 'via Drevvy',
      phone: '803-555-0148',
      email: 'deals@drevvy.test',
      zip: '29201',
      message,
    });
    assert.equal(page.outreach.some((fill) => fill.kind === 'message'), true);
    assert.deepEqual(page.submits, [{ formId: 'check-availability', buttonText: 'Check Availability' }]);
    assert.equal(JSON.stringify(page.outreach).includes(shopperPhone), false);
    assert.equal(JSON.stringify(page.outreach).includes(shopperEmail), false);
    assert.equal(store.attempts[0]?.first_reply_channel, null);
    assert.equal(store.attempts[0]?.channel, 'lead_form');
  });

  it('uses the message field on Ask a Question and a single name on Contact the Dealer', async () => {
    const ask = new FakeChatPage(readFixture('ask-a-question.html'));
    const askResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: ask,
      config: live,
      store: new MemoryAttemptStore(),
    });
    assert.equal(askResult.status, 'submitted');
    assert.equal(filled(ask).first_name, 'Maya');
    assert.equal(filled(ask).email, 'deals@drevvy.test');
    assert.equal(filled(ask).message, message);
    assert.equal(filled(ask).phone, undefined);

    const contact = new FakeChatPage(readFixture('contact-dealer.html'));
    await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: contact,
      config: { ...live, leadLastName: 'with Drevvy' },
      store: new MemoryAttemptStore(),
    });
    assert.equal(filled(contact).full_name, 'Maya with Drevvy');
    assert.equal(filled(contact).message, message);
  });

  it('fills Unlock Instant Price without inventing a message', async () => {
    const page = new FakeChatPage(readFixture('unlock-instant-price.html'));
    const result = await runLeadForm({ vehiclePageUrl: pageUrl, page, config: live, store: new MemoryAttemptStore() });
    assert.equal(result.status, 'submitted');
    assert.deepEqual(filled(page), {
      first_name: 'Maya',
      last_name: 'via Drevvy',
      phone: '803-555-0148',
      email: 'deals@drevvy.test',
    });
    assert.equal(page.submits.length, 1);
  });

  it('stops when ZIP is missing and fills it when configured', async () => {
    const missing = new FakeChatPage(readFixture('get-todays-price.html'));
    const missingResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: missing,
      config: { ...live, leadZip: null },
      store: new MemoryAttemptStore(),
    });
    assert.equal(missingResult.status, 'unknown');
    assert.equal(missingResult.stopReason, 'missing_zip');
    assert.deepEqual(missing.outreach, []);
    assert.deepEqual(missing.submits, []);

    const ready = new FakeChatPage(readFixture('get-todays-price.html'));
    const readyResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: ready,
      config: live,
      store: new MemoryAttemptStore(),
    });
    assert.equal(readyResult.status, 'submitted');
    assert.equal(filled(ready).zip, '29201');
    assert.match(filled(ready).first_name ?? '', /^Maya$/);
  });

  it('omits the stock sentence when the page has no stock number', async () => {
    const html = readFixture('ask-a-question.html').replace('Stock #H24118', 'call for details');
    const page = new FakeChatPage(html);
    await runLeadForm({ vehiclePageUrl: pageUrl, page, config: live, store: new MemoryAttemptStore() });
    assert.equal(
      filled(page).message,
      "Is this unit still available? What's the price on it? Please text or email us at 803-555-0148 / deals@drevvy.test.",
    );
  });

  it('does not submit a dry run or a dealer outside the allowlist', async () => {
    const dryPage = new FakeChatPage(readFixture('check-availability.html'));
    const dry = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: dryPage,
      config: { ...live, dryRun: true, allowlist: [] },
      store: new MemoryAttemptStore(),
    });
    assert.equal(dry.status, 'dry_run');
    assert.deepEqual(dryPage.outreach, []);
    assert.deepEqual(dryPage.submits, []);
    assert.equal(dry.transcript.some((entry) => entry.text.includes(message)), true);

    const blocked = new FakeChatPage(readFixture('check-availability.html'));
    const result = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: blocked,
      config: { ...live, allowlist: ['https://other.test'] },
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'not_allowlisted');
    assert.deepEqual(blocked.outreach, []);
    assert.deepEqual(blocked.submits, []);
  });

  it('submits one live lead form per vehicle', async () => {
    const store = new MemoryAttemptStore();
    const first = new FakeChatPage(readFixture('check-availability.html'));
    const firstResult = await runLeadForm({ vehiclePageUrl: pageUrl, page: first, config: live, store });
    const second = new FakeChatPage(readFixture('check-availability.html'));
    const secondResult = await runLeadForm({ vehiclePageUrl: pageUrl, page: second, config: live, store });

    assert.equal(firstResult.status, 'submitted');
    assert.equal(first.submits.length, 1);
    assert.equal(secondResult.status, 'already_submitted');
    assert.deepEqual(second.gotos, []);
    assert.deepEqual(second.outreach, []);
    assert.deepEqual(second.submits, []);
  });

  it('stops on captcha and on private fields without filling anything', async () => {
    const captcha = new FakeChatPage(readFixture('captcha-lead.html'));
    const captchaResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: captcha,
      config: live,
      store: new MemoryAttemptStore(),
    });
    assert.equal(captchaResult.status, 'captcha');
    assert.deepEqual(captcha.outreach, []);
    assert.deepEqual(captcha.submits, []);

    const privateForm = new FakeChatPage(readFixture('private-info.html'));
    const privateResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: privateForm,
      config: live,
      store: new MemoryAttemptStore(),
    });
    assert.equal(privateResult.status, 'private_info');
    assert.deepEqual(privateForm.outreach, []);
    assert.deepEqual(privateForm.submits, []);
  });

  it('stops when a required field has no approved value', async () => {
    const html = `<form id="extra">
      <h2>Check Availability</h2>
      <input name="first_name" required />
      <input type="email" name="email" required />
      <label for="prefer">Preferred contact</label>
      <input id="prefer" name="preferred_contact" required />
      <button>Check Availability</button>
    </form>`;
    const page = new FakeChatPage(html);
    const result = await runLeadForm({ vehiclePageUrl: pageUrl, page, config: live, store: new MemoryAttemptStore() });
    assert.equal(result.stopReason, 'unsupported_field');
    assert.deepEqual(page.outreach, []);
    assert.deepEqual(page.submits, []);
  });

  it('records a blocked site once and does not open it again', async () => {
    const store = new MemoryAttemptStore();
    const first = new FakeChatPage(readFixture('sokal-blocked.html'));
    const blocked = await runLeadForm({ vehiclePageUrl: pageUrl, page: first, config: live, store });
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.channel, 'lead_form');
    assert.deepEqual(first.gotos, [pageUrl]);
    assert.deepEqual(first.submits, []);

    const retry = new FakeChatPage(readFixture('sokal-blocked.html'));
    const again = await runLeadForm({ vehiclePageUrl: pageUrl, page: retry, config: live, store });
    assert.equal(again.status, 'blocked');
    assert.equal(again.id, null);
    assert.deepEqual(retry.gotos, []);
    assert.equal(store.attempts.length, 1);

    const chat = new FakeChatPage(readFixture('gubagoo-vdp.html'));
    const chatResult = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page: chat,
      ai: { async complete() { return '{}'; } },
      config: { ...live, maxTurns: 6 },
      store,
    });
    assert.equal(chatResult.status, 'blocked');
    assert.deepEqual(chat.gotos, []);
    assert.equal(store.attempts.length, 1);
  });

  it('leaves footer forms and widget pre-chat forms out of the lead pass', () => {
    assert.equal(detectLeadForms(readFixture('footer-lead-form.html')).length, 0);
    assert.equal(detectLeadForms(readFixture('prechat-form.html')).length, 0);
    assert.equal(detectLeadForms(readFixture('gubagoo-vdp.html')).length, 0);
    const podium = detectPrechat(extractWidgetScope(readFixture('podium-text-us.html'), 'podium'));
    assert.equal(podium?.buttonText, 'Text us');
    const plan = planForm(
      podium!,
      {
        firstName: 'Maya',
        lastName: 'via Drevvy',
        phone: '803-555-0148',
        email: 'deals@drevvy.test',
        zip: null,
      },
      'H24118',
      'prechat',
    );
    assert.equal(plan.stop, null);
    assert.equal(plan.fills.find((fill) => fill.kind === 'full_name')?.value, 'Maya');
  });

  it('records the widget as first reply after a lead form was submitted', async () => {
    const store = new MemoryAttemptStore();
    const leadPage = new FakeChatPage(readFixture('ask-a-question.html'));
    await runLeadForm({ vehiclePageUrl: pageUrl, page: leadPage, config: live, store });
    assert.equal(store.attempts[0]?.first_reply_channel, null);

    const chatPage = new FakeChatPage(readFixture('gubagoo-vdp.html'), {
      replies: ['Yes, this unit is still available.', 'Listing price is $24,995.'],
    });
    const chat = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page: chatPage,
      ai: {
        async complete(request) {
          const user = request.messages[1];
          const text = typeof user?.content === 'string' ? user.content : '';
          if (text.includes('$24,995')) return JSON.stringify({ status: 'price_given', price: '$24,995', next_message: 'continue_offline' });
          if (text.includes('available')) return JSON.stringify({ status: 'available', price: null, next_message: 'listing_price' });
          return JSON.stringify({ status: 'unknown', price: null, next_message: 'none' });
        },
      },
      config: { ...live, maxTurns: 6 },
      store,
    });
    assert.equal(chat.status, 'price_given');
    assert.equal(chat.channel, 'widget');
    assert.equal(store.attempts[0]?.channel, 'lead_form');
    assert.equal(store.attempts[0]?.first_reply_channel, 'widget');
    assert.equal(store.attempts[1]?.channel, 'widget');
    assert.equal(store.attempts[1]?.first_reply_channel, 'widget');
  });
});

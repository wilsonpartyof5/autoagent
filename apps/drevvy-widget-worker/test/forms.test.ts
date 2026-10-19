import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runWidgetChat } from '../src/chat/agent';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { detectLeadForms, detectPrechat, findLeadOpener } from '../src/forms/detect';
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
  shopperFirst: 'Maya',
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
    assert.equal(filled(page).message, 'Hi, is it still available?');
  });

  it('asks about the VIN ending when the page has a VIN and no stock number', async () => {
    const html = readFixture('ask-a-question.html').replace('Stock #H24118', 'VIN 1HGBH41JXMN109186');
    const page = new FakeChatPage(html);
    await runLeadForm({ vehiclePageUrl: pageUrl, page, config: live, store: new MemoryAttemptStore() });
    assert.equal(
      filled(page).message,
      'Hi, is VIN ending MN109186 still available?',
    );
    assert.equal(filled(page).message.includes('1HGBH41JXMN109186'), false);
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
    assert.deepEqual(dryPage.leadOpens, []);
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

  it('opens a late Team Velocity lead form and records the fields without submitting', async () => {
    const shell = '<html><body><script src="https://chat.matador.ai/widget.js"></script><p>Stock #277375A</p></body></html>';
    const page = new FakeChatPage(shell, {
      afterSettleHtml: readFixture('teamvelocity-vdp.html'),
      htmlAfterLeadOpen: readFixture('teamvelocity-lead.html'),
    });
    const result = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page,
      config: { ...live, dryRun: true, allowlist: [] },
      store: new MemoryAttemptStore(),
    });

    assert.equal(result.status, 'dry_run');
    assert.equal(result.stopReason, 'dry_run');
    assert.equal(result.widgetVendor, 'matador');
    assert.equal(result.stockNumber, '277375A');
    assert.deepEqual(page.leadOpens, ['Check Availability']);
    assert.deepEqual(page.outreach, []);
    assert.deepEqual(page.submits, []);
    assert.equal(page.sent.length, 0);
    assert.equal(result.transcript.some((entry) => entry.text === 'first_name: Maya'), true);
    assert.equal(result.transcript.some((entry) => entry.text === 'last_name: via Drevvy'), true);
    assert.equal(result.transcript.some((entry) => entry.text === 'phone: 803-555-0148'), true);
    assert.equal(result.transcript.some((entry) => entry.text === 'email: deals@drevvy.test'), true);
    assert.equal(result.transcript.some((entry) => entry.text === 'zip: 29201'), true);
    assert.equal(result.transcript.some((entry) => entry.text.startsWith('message:')), true);
    assert.equal(result.transcript.some((entry) => /honeypot/i.test(entry.text)), false);
    assert.equal(result.transcript.some((entry) => entry.text === 'Dry run: the lead form was not submitted.'), true);
  });

  it('submits a lead form that appears only after the vehicle CTA click', async () => {
    const page = new FakeChatPage(readFixture('teamvelocity-vdp.html').replace(/<a class="check-availability"[\s\S]*?<\/a>/, ''), {
      htmlAfterLeadOpen: readFixture('teamvelocity-lead.html'),
    });
    const result = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page,
      config: live,
      store: new MemoryAttemptStore(),
    });

    assert.equal(result.status, 'submitted');
    assert.deepEqual(page.leadOpens, ['Ask a Question']);
    assert.equal(filled(page).first_name, 'Maya');
    assert.equal(filled(page).email, 'deals@drevvy.test');
    assert.equal(filled(page).phone, '803-555-0148');
    assert.equal(Object.keys(filled(page)).includes('honeypot'), false);
    assert.deepEqual(page.submits, [{ formId: null, buttonText: 'Submit' }]);
  });

  it('reads a lead form from an iframe or an open shadow root without clicking', async () => {
    const form = readFixture('teamvelocity-lead.html');
    const host = '<html><body><p>Stock #277375A</p><a href="/contactus">Contact Us</a></body></html>';
    const framed = new FakeChatPage(host, { frames: [{ url: 'https://apps.dealer.test/lead', html: form }] });
    const frameResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: framed,
      config: { ...live, dryRun: true, allowlist: [] },
      store: new MemoryAttemptStore(),
    });
    assert.equal(frameResult.status, 'dry_run');
    assert.deepEqual(framed.leadOpens, []);
    assert.deepEqual(framed.submits, []);
    assert.equal(frameResult.transcript.some((entry) => entry.text === 'email: deals@drevvy.test'), true);

    const shadowed = new FakeChatPage(host, { shadowHtml: form });
    const shadowResult = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page: shadowed,
      config: { ...live, dryRun: true, allowlist: [] },
      store: new MemoryAttemptStore(),
    });
    assert.equal(shadowResult.status, 'dry_run');
    assert.deepEqual(shadowed.leadOpens, []);
    assert.deepEqual(shadowed.outreach, []);
    assert.equal(shadowResult.transcript.some((entry) => entry.text === 'phone: 803-555-0148'), true);
  });

  it('detects Confirm Availability and ignores footer contact links', () => {
    const confirmed = detectLeadForms(readFixture('confirm-availability.html'));
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0]?.buttonText, 'Confirm Availability');

    const revealed = detectLeadForms(readFixture('teamvelocity-lead.html'));
    assert.equal(revealed.length, 1);
    assert.equal(revealed[0]?.fields.some((field) => field.id === 'honeypot'), false);
    assert.equal(revealed[0]?.buttonText, 'Submit');

    const closed = readFixture('teamvelocity-vdp.html');
    assert.equal(detectLeadForms(closed).length, 0);
    assert.equal(findLeadOpener(closed), 'Check Availability');
    assert.equal(findLeadOpener('<a href="/contactus">Contact Us</a><button>Finance Application</button>'), null);
    assert.equal(
      findLeadOpener('<form><button type="submit">Check Availability</button></form>'),
      null,
    );
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
      config: { ...live, maxTurns: 6, listedPrice: 24995 },
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

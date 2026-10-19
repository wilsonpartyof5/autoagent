import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { runLeadForm } from '../src/forms/lead';
import { CALL_EMAIL_ONLY_AFTER, shouldMarkCallEmailOnly } from '../src/forms/stops';
import { createScreenshotSaver } from '../src/forms/screenshots';
import { isHoneypotField, patternForVendor, VENDOR_FORM_PATTERNS } from '../src/forms/vendor-patterns';
import { formatHealthSummary } from '../src/cli/format';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const live = {
  dryRun: false,
  allowlist: ['https://www.example-motors.test'],
  drevvyTextNumber: '803-555-0148',
  drevvyEmail: 'deals@drevvy.test',
  shopperFirst: 'Maya',
  leadLastName: 'via Drevvy',
  leadZip: '29201',
};

describe('vendor form patterns', () => {
  it('records Matador as the first opener pattern and stays extensible', () => {
    const matador = patternForVendor('matador');
    assert.equal(VENDOR_FORM_PATTERNS[0]?.vendor, 'matador');
    assert.equal(matador?.open, 'settle_then_click');
    assert.equal(matador?.submitButtonText, 'Send');
    assert.equal(matador?.honeypot.handling, 'leave_blank');
    assert.equal(matador?.formSelectors.includes('#matador-lead-form'), true);
    assert.equal(matador?.frameUrl?.test('https://chat.matador.ai/widget'), true);
    assert.equal(matador?.openerText.test('Check Availability'), true);
    assert.equal(matador?.openerText.test('Ask a Question'), true);
    assert.equal(patternForVendor('gubagoo'), null);
    assert.equal(patternForVendor(null), null);
    assert.equal(
      isHoneypotField(matador, { name: 'website', id: 'website', label: 'Website' }),
      true,
    );
    assert.equal(
      isHoneypotField(matador, { name: 'company_website', id: 'company_website', label: 'Company website' }),
      true,
    );
    assert.equal(
      isHoneypotField(matador, { name: 'company', id: 'company', label: 'Company' }),
      false,
    );
    assert.equal(
      isHoneypotField(matador, { name: 'first_name', id: 'first_name', label: 'First Name' }),
      false,
    );
  });

  it('opens a Matador form after settle and does not submit a dry run or a honeypot', async () => {
    const page = new FakeChatPage(readFixture('matador-opener.html'), {
      htmlAfterLeadOpen: readFixture('matador-lead.html'),
    });
    const store = new MemoryAttemptStore();
    const shots: Buffer[] = [];
    const result = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page,
      config: { ...live, dryRun: true, allowlist: [] },
      store,
      saveScreenshot: async (bytes) => {
        shots.push(bytes);
        return 'screenshots/example-motors.test/dry-run.png';
      },
    });

    assert.equal(result.status, 'dry_run');
    assert.equal(result.stopReason, 'dry_run');
    assert.equal(result.widgetVendor, 'matador');
    assert.deepEqual(page.leadOpens, ['Check Availability']);
    assert.equal(page.clicks.length, 0);
    assert.equal(page.submits.length, 0);
    assert.equal(page.outreach.length, 0);
    assert.equal(result.transcript.some((entry) => entry.text.includes('website')), false);
    assert.equal(result.transcript.some((entry) => entry.text.startsWith('first_name:')), true);
    assert.equal(store.attempts[0]?.screenshot_url, 'screenshots/example-motors.test/dry-run.png');
    assert.equal(shots.length, 1);
    assert.equal(/negotiat/i.test(JSON.stringify(result.transcript)), false);
  });

  it('submits the Matador button and leaves the honeypot blank', async () => {
    const page = new FakeChatPage(readFixture('matador-opener.html'), {
      htmlAfterLeadOpen: readFixture('matador-lead.html'),
    });
    const result = await runLeadForm({
      vehiclePageUrl: pageUrl,
      page,
      config: live,
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'submitted');
    assert.deepEqual(page.submits, [{ formId: 'matador-lead-form', buttonText: 'Send' }]);
    assert.equal(page.outreach.some((fill) => fill.name === 'website' || fill.kind === 'message' && fill.value.includes('website')), false);
    assert.equal(page.outreach.some((fill) => fill.name === 'website'), false);
    assert.equal(JSON.stringify(page.outreach).includes('212-555'), false);
    assert.deepEqual(page.leadOpens, ['Check Availability']);
  });

  it('clicks a Matador selector when the button text is not a shared opener', async () => {
    const shell = `<html><body>
      <script src="https://chat.matador.ai/widget.js"></script>
      <button type="button" data-matador="check-availability" class="matador-check-availability">Chat with us</button>
    </body></html>`;
    const page = new FakeChatPage(shell, {
      htmlAfterOpener: readFixture('matador-lead.html'),
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
    assert.deepEqual(page.leadOpens, []);
    assert.equal(page.clicks.length, 1);
    assert.equal(page.clicks[0]?.some((selector) => selector.includes('data-matador="check-availability"')), true);
    assert.equal(page.submits.length, 0);
    assert.equal(result.transcript.some((entry) => entry.text.includes('website')), false);
  });

  it('uses a specific stop reason and a screenshot when the form never appears', async () => {
    const cases: Array<{ html: string; options?: ConstructorParameters<typeof FakeChatPage>[1]; reason: string; status: string }> = [
      { html: readFixture('no-widget.html'), reason: 'form_not_found', status: 'unknown' },
      { html: readFixture('matador-vdp.html'), reason: 'opener_not_found', status: 'unknown' },
      { html: readFixture('gubagoo-vdp.html'), reason: 'unsupported_vendor', status: 'unknown' },
      {
        html: readFixture('matador-opener.html'),
        options: { unreadableLeadFrame: true },
        reason: 'iframe_blocked',
        status: 'unknown',
      },
      {
        html: readFixture('check-availability.html'),
        options: { settleError: new Error('Timeout 30000ms exceeded') },
        reason: 'timeout',
        status: 'page_timeout',
      },
    ];

    for (const item of cases) {
      const store = new MemoryAttemptStore();
      const result = await runLeadForm({
        vehiclePageUrl: pageUrl,
        page: new FakeChatPage(item.html, item.options),
        config: { ...live, dryRun: true, allowlist: [] },
        store,
        saveScreenshot: async () => `shots/${item.reason}.png`,
      });
      assert.equal(result.stopReason, item.reason, item.reason);
      assert.equal(result.status, item.status, item.reason);
      assert.equal(store.attempts[0]?.screenshot_url, `shots/${item.reason}.png`);
      assert.equal(store.attempts[0]?.dry_run, true);
    }
  });

  it('marks the dealer call/email only after repeated no-form failures', async () => {
    assert.equal(shouldMarkCallEmailOnly(CALL_EMAIL_ONLY_AFTER - 1), false);
    assert.equal(shouldMarkCallEmailOnly(CALL_EMAIL_ONLY_AFTER), true);
    const directory = new MemoryDirectoryStore();
    const store = new MemoryAttemptStore();
    for (let attempt = 0; attempt < CALL_EMAIL_ONLY_AFTER; attempt += 1) {
      await runLeadForm({
        vehiclePageUrl: pageUrl,
        page: new FakeChatPage(readFixture('no-widget.html')),
        config: { ...live, dryRun: true, allowlist: [] },
        store,
        directory,
      });
    }
    assert.equal((await directory.findBySiteUrl('https://www.example-motors.test'))?.call_email_only, true);
    assert.equal(store.attempts.every((attempt) => attempt.stop_reason === 'form_not_found'), true);

    const captchaDirectory = new MemoryDirectoryStore();
    const captchaStore = new MemoryAttemptStore();
    for (let attempt = 0; attempt < CALL_EMAIL_ONLY_AFTER; attempt += 1) {
      await runLeadForm({
        vehiclePageUrl: pageUrl,
        page: new FakeChatPage(readFixture('captcha-lead.html')),
        config: live,
        store: captchaStore,
        directory: captchaDirectory,
      });
    }
    assert.equal(captchaStore.attempts.every((attempt) => attempt.stop_reason === 'captcha'), true);
    assert.equal(await captchaDirectory.findBySiteUrl('https://www.example-motors.test'), null);
  });

  it('writes a screenshot file and can store a URL', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'drevvy-shots-'));
    const save = createScreenshotSaver(dir, 'https://shots.drevvy.test/attempts');
    const url = await save(Buffer.from('png'), pageUrl);
    assert.match(url, /^https:\/\/shots\.drevvy\.test\/attempts\/www\.example-motors\.test\/.+\.png$/);
    const file = path.join(dir, 'www.example-motors.test', url.split('/').pop() ?? '');
    assert.equal(await readFile(file, 'utf8'), 'png');
  });

  it('counts vendors and reasons in the health summary', () => {
    const summary = formatHealthSummary([
      { vendor: 'matador', status: 'dry_run', reason: 'dry_run' },
      { vendor: 'matador', status: 'unknown', reason: 'opener_not_found' },
      { vendor: '-', status: 'unknown', reason: 'form_not_found' },
    ]);
    assert.match(summary, /vendors: matador=2, unknown=1/);
    assert.match(summary, /reasons: dry_run=1, form_not_found=1, opener_not_found=1/);
    assert.equal(/negotiat/i.test(summary), false);
  });
});

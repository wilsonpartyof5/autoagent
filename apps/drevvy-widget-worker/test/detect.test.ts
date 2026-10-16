import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readFixture } from './fixture';
import { detectWidgetVendor } from '../src/widgets/detect';
import { extractStockNumber } from '../src/widgets/script';
import { WIDGET_ADAPTERS, WIDGET_VENDORS } from '../src/widgets/vendors';
import { asksForShopperContact, hasCaptchaChallenge, isForbiddenContactSelector } from '../src/widgets/guards';
import { extractWidgetScope } from '../src/widgets/vendors';

describe('widget snapshots', () => {
  for (const vendor of WIDGET_VENDORS) {
    it(`detects ${vendor}`, () => {
      const html = readFixture(`${vendor}-vdp.html`);
      assert.equal(detectWidgetVendor(html), vendor);
    });
  }

  it('ignores a page with no chat widget', () => {
    assert.equal(detectWidgetVendor(readFixture('no-widget.html')), null);
  });

  it('reads the stock number from the vehicle page', () => {
    assert.equal(extractStockNumber(readFixture('gubagoo-vdp.html')), 'H24118');
  });

  it('does not treat a recaptcha script tag as a challenge', () => {
    assert.equal(hasCaptchaChallenge(readFixture('gubagoo-vdp.html')), false);
  });

  it('stops on a captcha inside the widget', () => {
    const html = readFixture('captcha-widget.html');
    const scope = extractWidgetScope(html, 'gubagoo');
    assert.equal(hasCaptchaChallenge(scope), true);
  });

  it('stops on a pre-chat contact form and ignores a footer lead form', () => {
    const prechat = readFixture('prechat-form.html');
    assert.equal(asksForShopperContact(extractWidgetScope(prechat, 'gubagoo')), true);
    const footer = readFixture('footer-lead-form.html');
    assert.equal(asksForShopperContact(footer), true);
    assert.equal(asksForShopperContact(extractWidgetScope(footer, 'gubagoo')), false);
  });

  it('keeps composer selectors away from name, phone, and email fields', () => {
    for (const adapter of Object.values(WIDGET_ADAPTERS)) {
      const selectors = [...adapter.inputSelectors, ...adapter.sendSelectors, ...adapter.launchSelectors];
      for (const selector of selectors) {
        assert.equal(isForbiddenContactSelector(selector), false, selector);
      }
    }
  });
});

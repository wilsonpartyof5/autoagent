import type { Frame, Page } from 'playwright';

import { isPrivateFieldHint, type OutreachFill } from '../forms/outreach';
import { asksForShopperContact, hasCaptchaChallenge, isContactField, isForbiddenContactSelector } from '../widgets/guards';
import { WIDGET_ADAPTERS, type WidgetVendor } from '../widgets/vendors';
import type { ChatPage } from './types';

const CAPTCHA_FRAME = /google\.com\/recaptcha\/api2|hcaptcha\.com\/captcha|challenges\.cloudflare\.com\/turnstile/i;

function outreachSelectors(fill: OutreachFill): string[] {
  const selectors: string[] = [];
  if (fill.id && /^[\w.-]+$/.test(fill.id)) selectors.push(`[id="${fill.id}"]`);
  if (fill.name && /^[A-Za-z][\w:-]*$/.test(fill.name)) selectors.push(`[name="${fill.name}"]`);
  return selectors;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function launchChatBrowser(): Promise<{ chatPage: ChatPage; close: () => Promise<void> }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; DrevvyWidgetChat/0.1; +https://drevvy.com)',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  return {
    chatPage: new PlaywrightChatPage(page),
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

export class PlaywrightChatPage implements ChatPage {
  constructor(private readonly page: Page) {}

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }

  async content(): Promise<string> {
    return this.page.content();
  }

  async widgetHtml(vendor: WidgetVendor | null): Promise<string> {
    if (!vendor) return '';
    const adapter = WIDGET_ADAPTERS[vendor];
    for (const frame of this.page.frames()) {
      if (frame === this.page.mainFrame()) continue;
      if (!adapter.frameUrl.test(frame.url())) continue;
      try {
        return await frame.content();
      } catch {
        continue;
      }
    }
    for (const selector of adapter.containerSelectors) {
      if (isForbiddenContactSelector(selector)) continue;
      const loc = this.page.locator(selector).first();
      try {
        if ((await loc.count()) === 0) continue;
        return (await loc.innerHTML()) ?? '';
      } catch {
        continue;
      }
    }
    return '';
  }

  async readLatestDealerText(selectors: string[]): Promise<string | null> {
    const deadline = Date.now() + 8_000;
    let text = await this.readOnce(selectors);
    while (!text && Date.now() < deadline) {
      await delay(400);
      text = await this.readOnce(selectors);
    }
    return text;
  }

  private async readOnce(selectors: string[]): Promise<string | null> {
    for (const frame of this.page.frames()) {
      for (const selector of selectors) {
        if (isForbiddenContactSelector(selector)) continue;
        try {
          const loc = frame.locator(selector);
          const count = await loc.count();
          if (count === 0) continue;
          const text = (await loc.nth(count - 1).innerText()).trim();
          if (text) return text;
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  async screenshot(): Promise<Buffer> {
    const bytes = await this.page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(bytes);
  }

  async click(selectors: string[]): Promise<boolean> {
    return this.withSelector(selectors, async (frame, selector) => {
      const loc = frame.locator(selector).first();
      if ((await loc.count()) === 0) return false;
      await loc.click({ timeout: 2_000 });
      return true;
    });
  }

  async fill(selectors: string[], value: string): Promise<boolean> {
    return this.withSelector(selectors, async (frame, selector) => {
      const loc = frame.locator(selector).first();
      if ((await loc.count()) === 0) return false;
      const attrs = {
        type: await loc.getAttribute('type'),
        name: await loc.getAttribute('name'),
        id: await loc.getAttribute('id'),
        placeholder: await loc.getAttribute('placeholder'),
        ariaLabel: await loc.getAttribute('aria-label'),
      };
      if (isContactField(attrs)) return false;
      await loc.fill(value, { timeout: 2_000 });
      return true;
    });
  }

  async pressEnter(selectors: string[]): Promise<boolean> {
    return this.withSelector(selectors, async (frame, selector) => {
      const loc = frame.locator(selector).first();
      if ((await loc.count()) === 0) return false;
      const attrs = {
        type: await loc.getAttribute('type'),
        name: await loc.getAttribute('name'),
        id: await loc.getAttribute('id'),
        placeholder: await loc.getAttribute('placeholder'),
        ariaLabel: await loc.getAttribute('aria-label'),
      };
      if (isContactField(attrs)) return false;
      await loc.press('Enter', { timeout: 2_000 });
      return true;
    });
  }

  async captchaVisible(vendor: WidgetVendor | null): Promise<boolean> {
    const html = await this.widgetHtml(vendor);
    if (hasCaptchaChallenge(html)) return true;
    if (!vendor) return false;
    const adapter = WIDGET_ADAPTERS[vendor];
    return this.page.frames().some((frame) => {
      if (!CAPTCHA_FRAME.test(frame.url())) return false;
      let parent = frame.parentFrame();
      while (parent) {
        if (adapter.frameUrl.test(parent.url())) return true;
        parent = parent.parentFrame();
      }
      return false;
    });
  }

  async contactFormVisible(vendor: WidgetVendor | null): Promise<boolean> {
    return asksForShopperContact(await this.widgetHtml(vendor));
  }

  async fillOutreach(fill: OutreachFill): Promise<boolean> {
    if (isPrivateFieldHint(`${fill.name ?? ''} ${fill.id ?? ''}`)) return false;
    const selectors = outreachSelectors(fill);
    if (selectors.length === 0) return false;
    for (const selector of selectors) {
      for (const frame of this.page.frames()) {
        try {
          const loc = frame.locator(selector).first();
          if ((await loc.count()) === 0) continue;
          const blob = [
            await loc.getAttribute('name'),
            await loc.getAttribute('id'),
            await loc.getAttribute('placeholder'),
            await loc.getAttribute('aria-label'),
          ]
            .filter((part): part is string => Boolean(part))
            .join(' ');
          if (isPrivateFieldHint(blob)) return false;
          await loc.fill(fill.value, { timeout: 2_000 });
          return true;
        } catch {
          continue;
        }
      }
    }
    return false;
  }

  async submitForm(formId: string | null, buttonText: string | null): Promise<boolean> {
    const formSelector = formId && /^[\w.-]+$/.test(formId) ? `form[id="${formId}"]` : 'form';
    for (const frame of this.page.frames()) {
      try {
        const form = frame.locator(formSelector).first();
        if ((await form.count()) === 0) continue;
        if (buttonText) {
          const named = form.getByRole('button', { name: buttonText, exact: true }).first();
          if ((await named.count()) > 0) {
            await named.click({ timeout: 2_000 });
            return true;
          }
        }
        const submit = form.locator('button[type="submit"], input[type="submit"], button').first();
        if ((await submit.count()) === 0) continue;
        await submit.click({ timeout: 2_000 });
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  private async withSelector(
    selectors: string[],
    visit: (frame: Frame, selector: string) => Promise<boolean>,
  ): Promise<boolean> {
    for (const selector of selectors) {
      if (isForbiddenContactSelector(selector)) continue;
      for (const frame of this.page.frames()) {
        try {
          if (await visit(frame, selector)) return true;
        } catch {
          continue;
        }
      }
    }
    return false;
  }
}

import type { ChatPage } from '../chat/types';
import { hasCaptchaChallenge } from '../widgets/guards';
import { isTimeoutError } from '../widgets/timeout';
import { detectWidgetVendor } from '../widgets/detect';
import { vendorFromModel, type WidgetVendor } from '../widgets/vendors';
import { detectLeadForms, type ParsedForm } from './detect';
import { leadStopNote, type LeadFormStop } from './stops';
import { patternForVendor, type VendorFormPattern } from './vendor-patterns';

export type LocatedLeadForm = {
  html: string;
  vendor: string | null;
  form: ParsedForm | null;
  pattern: VendorFormPattern | null;
  stop: LeadFormStop | null;
  note: string | null;
};

/**
 * Wait for the page, then look in the document, iframes, and open shadow roots.
 * A missing form is opened with the shared vehicle-page control first
 * (Check Availability, Ask a Question, and the other recorded labels).
 * A known vendor pattern can still click its own selectors after that.
 */
export async function locateLeadForm(page: ChatPage): Promise<LocatedLeadForm> {
  try {
    await page.settle();
    await page.dismissOverlays();
  } catch (error) {
    if (isTimeoutError(error)) return stopped('', null, null, 'timeout');
    throw error;
  }

  let html = await readMarkup(page);
  if (typeof html !== 'string') return html;
  let vendor = detectWidgetVendor(html);
  const pattern = patternForVendor(vendor);
  let form = firstForm(html);
  if (form) return found(html, vendor, form, pattern);
  if (await captcha(page, html, vendor)) return stopped(html, vendor, pattern, 'captcha');

  const opened = await openForm(page, pattern);
  if (opened === 'timeout') return stopped(html, vendor, pattern, 'timeout');
  if (opened === 'clicked') {
    const next = await readMarkup(page);
    if (typeof next !== 'string') return { ...next, vendor, pattern };
    html = next;
    vendor = detectWidgetVendor(html) ?? vendor;
    form = firstForm(html);
    if (form) return found(html, vendor, form, patternForVendor(vendor) ?? pattern);
    if (await captcha(page, html, vendor)) return stopped(html, vendor, pattern, 'captcha');
    if (await frameBlocked(page, pattern)) return stopped(html, vendor, pattern, 'iframe_blocked');
    return stopped(html, vendor, pattern, 'form_not_found');
  }

  if (pattern) {
    if (await frameBlocked(page, pattern)) return stopped(html, vendor, pattern, 'iframe_blocked');
    return stopped(html, vendor, pattern, 'opener_not_found');
  }
  if (vendor) return stopped(html, vendor, null, 'unsupported_vendor');
  return stopped(html, vendor, null, 'form_not_found');
}

async function openForm(page: ChatPage, pattern: VendorFormPattern | null): Promise<'clicked' | 'missed' | 'timeout'> {
  try {
    if (await page.clickLeadOpener()) return 'clicked';
    if (pattern && (await page.clickOpener(pattern.openerSelectors, pattern.openerText))) return 'clicked';
    return 'missed';
  } catch (error) {
    if (isTimeoutError(error)) return 'timeout';
    throw error;
  }
}

async function readMarkup(page: ChatPage): Promise<string | LocatedLeadForm> {
  try {
    const [main, frames, shadow] = await Promise.all([
      page.content(),
      page.frames().catch(() => []),
      page.shadowHtml().catch(() => ''),
    ]);
    return [main, ...frames.map((frame) => frame.html), shadow].join('\n');
  } catch (error) {
    if (isTimeoutError(error)) return stopped('', null, null, 'timeout');
    throw error;
  }
}

function firstForm(html: string): ParsedForm | null {
  return detectLeadForms(html)[0] ?? null;
}

async function captcha(page: ChatPage, html: string, vendor: string | null): Promise<boolean> {
  if (hasCaptchaChallenge(html)) return true;
  return page.captchaVisible(knownVendor(vendor));
}

function knownVendor(vendor: string | null): WidgetVendor | null {
  return vendorFromModel(vendor);
}

async function frameBlocked(page: ChatPage, pattern: VendorFormPattern | null): Promise<boolean> {
  if (!pattern?.frameUrl) return false;
  return page.unreadableFrame(pattern.frameUrl);
}

function found(
  html: string,
  vendor: string | null,
  form: ParsedForm | null,
  pattern: VendorFormPattern | null,
): LocatedLeadForm {
  return { html, vendor, form, pattern, stop: null, note: null };
}

function stopped(
  html: string,
  vendor: string | null,
  pattern: VendorFormPattern | null,
  reason: LeadFormStop,
): LocatedLeadForm {
  return { html, vendor, form: null, pattern, stop: reason, note: leadStopNote(reason) };
}

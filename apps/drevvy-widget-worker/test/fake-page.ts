import { findLeadOpener } from '../src/forms/detect';
import type { OutreachFill } from '../src/forms/outreach';
import { isPrivateFieldHint } from '../src/forms/outreach';
import type { ChatPage } from '../src/chat/types';
import type { FrameSnapshot } from '../src/widgets/evidence';
import type { FieldAttrs } from '../src/widgets/guards';
import { isContactField } from '../src/widgets/guards';
import { hasCaptchaChallenge } from '../src/widgets/guards';
import { htmlHasAnySelector } from '../src/widgets/match';
import { isOverlayDismiss, overlayButtons } from '../src/widgets/overlays';
import { extractWidgetScope, type WidgetVendor } from '../src/widgets/vendors';

export class FakeChatPage implements ChatPage {
  readonly sent: string[] = [];
  readonly clicks: string[][] = [];
  readonly gotos: string[] = [];
  readonly outreach: OutreachFill[] = [];
  readonly submits: Array<{ formId: string | null; buttonText: string | null }> = [];
  readonly points: Array<{ x: number; y: number }> = [];
  readonly dismissed: string[] = [];
  readonly leadOpens: string[] = [];
  screenshots = 0;
  private currentHtml: string;
  private composerOpen = false;

  constructor(
    readonly html: string,
    private readonly options: {
      replies?: Array<string | null>;
      composerAttrs?: FieldAttrs;
      failSendClick?: boolean;
      failOutreach?: boolean;
      failSubmit?: boolean;
      gotoError?: Error;
      afterSettleHtml?: string;
      htmlAfterLeadOpen?: string;
      shadowHtml?: string;
      htmlAfterDismiss?: string;
      networkUrls?: string[];
      frames?: FrameSnapshot[];
      composerAfterLaunch?: boolean;
      composerAfterVision?: boolean;
      httpStatus?: number | null;
      contentError?: Error;
      gotoDelayMs?: number;
      htmlAfterOpener?: string;
      unreadableLeadFrame?: boolean;
      settleError?: Error;
    } = {},
  ) {
    this.currentHtml = html;
  }

  private replyIndex = 0;

  async goto(url: string): Promise<void> {
    if (this.options.gotoDelayMs) await new Promise((resolve) => setTimeout(resolve, this.options.gotoDelayMs));
    if (this.options.gotoError) throw this.options.gotoError;
    this.gotos.push(url);
  }

  httpStatus(): number | null {
    return this.options.httpStatus ?? null;
  }

  async content(): Promise<string> {
    if (this.options.contentError) {
      const error = this.options.contentError;
      this.options.contentError = undefined;
      throw error;
    }
    return this.currentHtml;
  }

  async widgetHtml(_vendor: WidgetVendor | null): Promise<string> {
    return '';
  }

  async readLatestDealerText(_selectors: string[]): Promise<string | null> {
    const replies = this.options.replies ?? [];
    if (this.replyIndex >= replies.length) return null;
    const next = replies[this.replyIndex];
    this.replyIndex += 1;
    return next;
  }

  async screenshot(): Promise<Buffer> {
    this.screenshots += 1;
    return Buffer.from('fake-png');
  }

  async click(selectors: string[]): Promise<boolean> {
    this.clicks.push(selectors);
    if (this.options.failSendClick && selectors.some((selector) => selector.includes('send') || selector.includes('Send'))) {
      return false;
    }
    if (this.options.composerAfterLaunch) this.composerOpen = true;
    return true;
  }

  async fill(_selectors: string[], value: string): Promise<boolean> {
    if (this.options.composerAttrs && isContactField(this.options.composerAttrs)) return false;
    this.sent.push(value);
    return true;
  }

  async pressEnter(_selectors: string[]): Promise<boolean> {
    return !this.options.failSendClick;
  }

  async captchaVisible(vendor: WidgetVendor | null): Promise<boolean> {
    const scope = vendor ? extractWidgetScope(this.currentHtml, vendor) : '';
    if (scope && hasCaptchaChallenge(scope)) return true;
    const frames = this.visibleFrames(null);
    if (frames.some((frame) => hasCaptchaChallenge(frame.html))) return true;
    return hasCaptchaChallenge(this.currentHtml);
  }

  async contactFormVisible(_vendor: WidgetVendor | null): Promise<boolean> {
    return Boolean(this.options.composerAttrs && isContactField(this.options.composerAttrs));
  }

  async fillOutreach(fill: OutreachFill): Promise<boolean> {
    if (this.options.failOutreach) return false;
    if (isPrivateFieldHint(`${fill.name ?? ''} ${fill.id ?? ''}`)) return false;
    this.outreach.push(fill);
    return true;
  }

  async submitForm(formId: string | null, buttonText: string | null): Promise<boolean> {
    if (this.options.failSubmit) return false;
    this.submits.push({ formId, buttonText });
    return true;
  }

  async settle(): Promise<void> {
    if (this.options.settleError) throw this.options.settleError;
    if (this.options.afterSettleHtml) this.currentHtml = this.options.afterSettleHtml;
  }

  async shadowHtml(): Promise<string> {
    return this.options.shadowHtml ?? '';
  }

  async clickLeadOpener(): Promise<boolean> {
    const label = findLeadOpener(this.currentHtml);
    if (!label) return false;
    this.leadOpens.push(label);
    if (this.options.htmlAfterLeadOpen) this.currentHtml = this.options.htmlAfterLeadOpen;
    return true;
  }

  async clickOpener(selectors: string[], text: RegExp): Promise<boolean> {
    this.clicks.push(selectors);
    const selectorHit = htmlHasAnySelector(this.currentHtml, selectors);
    const textHit = text.test(this.currentHtml.replace(/<[^>]+>/g, ' '));
    if (!selectorHit && !textHit) return false;
    if (this.options.htmlAfterOpener) this.currentHtml = this.options.htmlAfterOpener;
    return true;
  }

  async unreadableFrame(_urlPattern: RegExp): Promise<boolean> {
    return this.options.unreadableLeadFrame === true;
  }

  networkUrls(): string[] {
    return this.options.networkUrls ?? [];
  }

  async frames(): Promise<FrameSnapshot[]> {
    return this.options.frames ?? [];
  }

  async dismissOverlays(): Promise<string[]> {
    const names = overlayButtons(this.currentHtml)
      .filter((button) => isOverlayDismiss(button.label, button.context))
      .map((button) => button.label);
    this.dismissed.push(...names);
    if (names.length > 0 && this.options.htmlAfterDismiss) this.currentHtml = this.options.htmlAfterDismiss;
    return names;
  }

  async launcherVisible(selectors: string[], frameUrl: RegExp | null): Promise<boolean> {
    if (htmlHasAnySelector(this.currentHtml, selectors)) return true;
    return this.visibleFrames(frameUrl).some((frame) => htmlHasAnySelector(frame.html, selectors) || (frameUrl != null && /<button\b/i.test(frame.html)));
  }

  async composerVisible(selectors: string[], frameUrl: RegExp | null): Promise<boolean> {
    if (this.composerOpen) return true;
    if (htmlHasAnySelector(this.currentHtml, selectors)) return true;
    return this.visibleFrames(frameUrl).some((frame) => {
      if (htmlHasAnySelector(frame.html, selectors)) return true;
      return frameUrl != null && /<textarea\b|contenteditable=["']true["']/i.test(frame.html);
    });
  }

  async clickPoint(x: number, y: number): Promise<boolean> {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 4000 || y > 4000) return false;
    this.points.push({ x, y });
    if (this.options.composerAfterVision) this.composerOpen = true;
    return true;
  }

  async close(): Promise<void> {
    return undefined;
  }

  private visibleFrames(frameUrl: RegExp | null): FrameSnapshot[] {
    const frames = this.options.frames ?? [];
    if (!frameUrl) return frames;
    return frames.filter((frame) => frameUrl.test(frame.url));
  }
}

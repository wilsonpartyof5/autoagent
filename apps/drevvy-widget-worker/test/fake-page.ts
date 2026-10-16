import type { OutreachFill } from '../src/forms/outreach';
import { isPrivateFieldHint } from '../src/forms/outreach';
import type { ChatPage } from '../src/chat/types';
import type { FieldAttrs } from '../src/widgets/guards';
import { isContactField } from '../src/widgets/guards';
import type { WidgetVendor } from '../src/widgets/vendors';

export class FakeChatPage implements ChatPage {
  readonly sent: string[] = [];
  readonly clicks: string[][] = [];
  readonly gotos: string[] = [];
  readonly outreach: OutreachFill[] = [];
  readonly submits: Array<{ formId: string | null; buttonText: string | null }> = [];
  screenshots = 0;

  constructor(
    readonly html: string,
    private readonly options: {
      replies?: Array<string | null>;
      composerAttrs?: FieldAttrs;
      failSendClick?: boolean;
      failOutreach?: boolean;
      failSubmit?: boolean;
    } = {},
  ) {}

  private replyIndex = 0;

  async goto(url: string): Promise<void> {
    this.gotos.push(url);
  }

  async content(): Promise<string> {
    return this.html;
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

  async captchaVisible(_vendor: WidgetVendor | null): Promise<boolean> {
    return false;
  }

  async contactFormVisible(_vendor: WidgetVendor | null): Promise<boolean> {
    return false;
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

  async close(): Promise<void> {
    return undefined;
  }
}

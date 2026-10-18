import type { OutreachFill } from '../forms/outreach';
import type { FrameSnapshot } from '../widgets/evidence';
import type { WidgetVendor } from '../widgets/vendors';

export const ATTEMPT_CHANNELS = ['widget', 'lead_form', 'prechat'] as const;

export type AttemptChannel = (typeof ATTEMPT_CHANNELS)[number];

export const ATTEMPT_STATUSES = [
  'available',
  'sold',
  'price_given',
  'asked_contact',
  'human_handoff',
  'unknown',
  'dry_run',
  'captcha',
  'contact_form',
  'not_allowlisted',
  'no_widget',
  'turn_limit',
  'error',
  'blocked',
  'submitted',
  'private_info',
  'already_submitted',
  'widget_offline',
  'page_timeout',
  'composer_not_found',
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export type TranscriptVia = 'text' | 'screenshot' | 'planned';

export type TranscriptEntry = {
  role: 'agent' | 'dealer' | 'system';
  text: string;
  at: string;
  via?: TranscriptVia;
};

export const DAY0_FALLBACK = 'email_text_call' as const;

export type Day0Fallback = typeof DAY0_FALLBACK;

export type ChannelSelection = {
  selected_channels: string | null;
  channel_reason: string | null;
  fallback: Day0Fallback | null;
};

export type WidgetChatAttemptWrite = {
  vehicle_page_url: string;
  dealer_site_url: string | null;
  stock_number: string | null;
  widget_vendor: string | null;
  status: AttemptStatus;
  price: string | null;
  dry_run: boolean;
  transcript: TranscriptEntry[];
  stop_reason: string | null;
  error: string | null;
  started_at: string;
  finished_at: string;
  channel: AttemptChannel;
  first_reply_channel: AttemptChannel | null;
  selected_channels?: string | null;
  channel_reason?: string | null;
  fallback?: Day0Fallback | null;
};

export function selectionColumns(selection: ChannelSelection | null | undefined): Partial<ChannelSelection> {
  if (!selection) return {};
  return {
    selected_channels: selection.selected_channels,
    channel_reason: selection.channel_reason,
    fallback: selection.fallback,
  };
}

export interface AttemptStore {
  insert(attempt: WidgetChatAttemptWrite): Promise<{ id: string }>;
  annotate(id: string, selection: ChannelSelection): Promise<void>;
  hasBlockedSite(dealerSiteUrl: string): Promise<boolean>;
  hasLiveSubmit(vehiclePageUrl: string, channel: AttemptChannel): Promise<boolean>;
  currentFirstReply(vehiclePageUrl: string): Promise<AttemptChannel | null>;
  setFirstReply(vehiclePageUrl: string, channel: AttemptChannel): Promise<void>;
}

export type AttemptResult = {
  id: string | null;
  vehiclePageUrl: string;
  dealerSiteUrl: string | null;
  stockNumber: string | null;
  widgetVendor: string | null;
  status: AttemptStatus;
  price: string | null;
  dryRun: boolean;
  transcript: TranscriptEntry[];
  stopReason: string | null;
  error: string | null;
  channel: AttemptChannel;
};

export interface ChatPage {
  goto(url: string): Promise<void>;
  httpStatus(): number | null;
  content(): Promise<string>;
  widgetHtml(vendor: WidgetVendor | null): Promise<string>;
  readLatestDealerText(selectors: string[]): Promise<string | null>;
  screenshot(): Promise<Buffer>;
  click(selectors: string[]): Promise<boolean>;
  fill(selectors: string[], value: string): Promise<boolean>;
  pressEnter(selectors: string[]): Promise<boolean>;
  captchaVisible(vendor: WidgetVendor | null): Promise<boolean>;
  contactFormVisible(vendor: WidgetVendor | null): Promise<boolean>;
  fillOutreach(fill: OutreachFill): Promise<boolean>;
  submitForm(formId: string | null, buttonText: string | null): Promise<boolean>;
  settle(): Promise<void>;
  /** Open shadow-root form markup. Light-DOM HTML stays on `content()`. */
  shadowHtml(): Promise<string>;
  /**
   * Clicks one visible vehicle-page control that reveals a lead form.
   * Does not click a submit button that is already inside a form.
   */
  clickLeadOpener(): Promise<boolean>;
  networkUrls(): string[];
  frames(): Promise<FrameSnapshot[]>;
  dismissOverlays(): Promise<string[]>;
  launcherVisible(selectors: string[], frameUrl: RegExp | null): Promise<boolean>;
  composerVisible(selectors: string[], frameUrl: RegExp | null): Promise<boolean>;
  clickPoint(x: number, y: number): Promise<boolean>;
}

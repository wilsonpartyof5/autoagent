import type { WidgetVendor } from '../widgets/vendors';

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
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export type TranscriptVia = 'text' | 'screenshot' | 'planned';

export type TranscriptEntry = {
  role: 'agent' | 'dealer' | 'system';
  text: string;
  at: string;
  via?: TranscriptVia;
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
};

export interface AttemptStore {
  insert(attempt: WidgetChatAttemptWrite): Promise<{ id: string }>;
}

export interface ChatPage {
  goto(url: string): Promise<void>;
  content(): Promise<string>;
  widgetHtml(vendor: WidgetVendor | null): Promise<string>;
  readLatestDealerText(selectors: string[]): Promise<string | null>;
  screenshot(): Promise<Buffer>;
  click(selectors: string[]): Promise<boolean>;
  fill(selectors: string[], value: string): Promise<boolean>;
  pressEnter(selectors: string[]): Promise<boolean>;
  captchaVisible(vendor: WidgetVendor | null): Promise<boolean>;
  contactFormVisible(vendor: WidgetVendor | null): Promise<boolean>;
}

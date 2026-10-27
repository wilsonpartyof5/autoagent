/** Dealer desk v0.1 shapes. Mock data only. No shopper contact fields. */

export const CONVERSATION_STAGES = [
  'new_request',
  'in_conversation',
  'numbers_shared',
  'closed',
  'car_sold',
  'no_reply',
] as const;

export type ConversationStage = (typeof CONVERSATION_STAGES)[number];

export const INBOX_FILTERS = ['needs_reply', 'in_chat', 'all'] as const;
export const INBOX_API_FILTERS = [
  ...INBOX_FILTERS,
  'all_open',
  'closed',
] as const;

export type InboxFilter = (typeof INBOX_API_FILTERS)[number];

export const ANALYTICS_RANGES = ['7d', '30d', '90d'] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type MessageAuthor = 'drevvy' | 'shopper' | 'salesperson';

export type MessageKind = 'chat' | 'opener' | 'numbers';

export interface ThreadMessage {
  id: string;
  author: MessageAuthor;
  kind: MessageKind;
  body: string;
  sentAt: string;
}

export interface VehicleSummary {
  year: number;
  make: string;
  model: string;
  trim: string;
}

export interface Conversation {
  id: string;
  /** First name only. Never last name, phone, email, or address. */
  shopperFirstName: string;
  /** Opaque desk reference. Not a name, city, or contact. */
  shopperRef: string;
  rooftopId: 'lakeside' | 'midtown' | 'airport';
  stage: ConversationStage;
  vehicle: VehicleSummary;
  stockNumber: string;
  advertisedPriceCents: number;
  /** Price the salesperson typed into Share numbers. Null until then. */
  statedPriceCents: number | null;
  /** Informational written total. Not a binding offer. */
  writtenOtdCents: number | null;
  openedAt: string;
  firstReplyAt: string | null;
  /** Display deadline for the inbox timer. Not an SLA policy. */
  replyDueAt: string;
  messages: ThreadMessage[];
  otdWarningCount?: number;
  otdRemovalRecommended?: boolean;
  /** Separate from the OTD ladder. Dealer pushed come-in more than once. */
  comeInAdminFlag?: boolean;
}

export interface SlaChip {
  label: string;
  tone: 'waiting' | 'overdue' | 'replied' | 'ended';
}

export interface ReplyTemplate {
  id: string;
  label: string;
  text: string;
}

export interface InboxItem {
  id: string;
  shopperFirstName: string;
  shopperRef: string;
  rooftopId: Conversation['rooftopId'];
  stage: ConversationStage;
  stageLabel: string;
  vehicleTitle: string;
  stockNumber: string;
  advertisedPriceCents: number;
  statedPriceCents: number | null;
  priceDiffers: boolean;
  snippet: string;
  needsReply: boolean;
  openedAt: string;
  replyDueAt: string;
  sla: SlaChip;
}

export interface ConversationDetail extends Conversation {
  vehicleTitle: string;
  stageLabel: string;
  priceDiffers: boolean;
  needsReply: boolean;
  snippet: string;
  sla: SlaChip;
  replyTemplates: ReplyTemplate[];
}

export interface AnalyticsSummary {
  source: 'mock';
  range: AnalyticsRange;
  rangeLabel: string;
  replyRate: number;
  medianFirstReplyMinutes: number;
  conversationsStarted: number;
  conversationsClosed: number;
  numbersShared: number;
}

export interface CloseCharge {
  id: string;
  conversationId: string;
  shopperRef: string;
  vehicleTitle: string;
  amountCents: number;
  /** Placeholder row. Not a Stripe charge. */
  status: 'placeholder';
  closedAt: string;
}

export interface BillingSnapshot {
  source: 'mock';
  role: 'owner_gm';
  dayToDay: 'free';
  closeFeeCents: number;
  closeFeeLabel: string;
  paymentMethod: {
    brand: 'Visa';
    last4: '4242';
    placeholder: true;
  };
  charges: CloseCharge[];
}

export type DealerDemoError =
  | 'not_found'
  | 'empty_message'
  | 'message_too_long'
  | 'invalid_price'
  | 'conversation_closed';

export const DEMO_ROOFTOP = {
  name: 'Demo Rooftop',
  docFeeDefaultCents: 49900,
} as const;

export const TOUCHPOINT_IDS = [
  'D0-E1',
  'D0-C1',
  'D0-T1',
  'D0-TS',
  'D0-C2',
  'D1-E2',
  'D1-T2',
  'D2-C3',
  'D2-T3',
  'D4-E3',
  'D4-T4',
  'D5-E4',
  'VM-1',
] as const;

export type TouchpointId = (typeof TOUCHPOINT_IDS)[number];

export const VARIANTS = ['A', 'B', 'C'] as const;
export type Variant = (typeof VARIANTS)[number];

export const CHANNELS = ['email', 'sms', 'call', 'voicemail'] as const;
export type OutreachChannel = (typeof CHANNELS)[number];

export const CALL_OUTCOMES = [
  'number_captured',
  'transferred',
  'voicemail',
  'sold',
  'refused',
  'no_answer',
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const SEND_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'failed',
  'skipped_not_textable',
] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const STOP_REASONS = ['reply', 'sold', 'opt_out', 'ended_no_response', 'in_progress'] as const;
export type StopReason = (typeof STOP_REASONS)[number];

export const DREVVY_NUMBER = '843-555-0123';

/** Sends below this count show "not enough data" instead of a confidence interval. */
export const MIN_VARIANT_SENDS = 30;

export type OutreachEvent = {
  id: string;
  dealId: string;
  dealerId: string;
  vehicleId: string;
  touchpoint: TouchpointId;
  variant: Variant;
  channel: OutreachChannel;
  direction: 'outbound' | 'inbound';
  toType: 'main_line' | 'salesperson' | 'email';
  sentAt: string;
  dealerLocalTime: string;
  dealerTz: string;
  dayOfWeek: string;
  status: SendStatus;
  openedAt: string | null;
  replied: boolean;
  replyAt: string | null;
  replyChannel: 'email' | 'sms' | 'call' | null;
  callOutcome: CallOutcome | null;
  callDurationS: number | null;
  capturedNumber: string | null;
  optOut: boolean;
  dealerType: 'franchise' | 'independent';
  brand: string;
  region: string;
  dealerSize: 'small' | 'mid' | 'large';
  body: string;
  transcript: string | null;
  summary: string | null;
};

export type OutreachDeal = {
  id: string;
  shopperFirst: string;
  dealerId: string;
  dealerName: string;
  dealerType: 'franchise' | 'independent';
  brand: string;
  region: string;
  dealerSize: 'small' | 'mid' | 'large';
  dealerTz: string;
  mainLineTextable: boolean;
  vehicleId: string;
  vehicle: string;
  vehicleShort: string;
  stock: string;
  listedPrice: number;
  startedAt: string;
  stop: StopReason;
  stopAt: string | null;
  otdReceived: boolean;
  firstReplyAt: string | null;
  firstReplyTouchpoint: TouchpointId | null;
  replyWithin5Days: boolean;
  events: OutreachEvent[];
};

export type VariantStat = {
  touchpoint: TouchpointId;
  variant: Variant;
  sends: number;
  replies: number;
  replyRate: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  enoughData: boolean;
  medianHoursToReply: number | null;
  optOuts: number;
  trafficShare: number | null;
  winner: boolean;
  loser: boolean;
  guardrail: boolean;
};

export type SegmentStat = {
  label: string;
  deals: number;
  replies: number;
  replyRate: number | null;
};

export type OutreachReport = {
  from: string;
  to: string;
  kpis: {
    dealsContacted: number;
    emailsSent: number;
    textsSent: number;
    callsSent: number;
    voicemailsSent: number;
    textsSkipped: number;
    replyRateWithin5Days: number | null;
    medianHoursToFirstReply: number | null;
    otdReceivedRate: number | null;
    numberCaptureRate: number | null;
    optOutRate: number | null;
    soldBeforeReplyRate: number | null;
    endedNoResponse: number;
  };
  firstReplyByDay: Array<{ day: number; count: number }>;
  firstReplyByTouchpoint: Array<{ touchpoint: TouchpointId; count: number }>;
  stops: Array<{ reason: StopReason; count: number }>;
  variants: VariantStat[];
  channels: Array<{ channel: OutreachChannel; sent: number; replies: number; replyRate: number | null }>;
  callOutcomes: Array<{ outcome: CallOutcome; count: number; avgDurationS: number | null }>;
  avgCallDurationS: number | null;
  segments: {
    dealerType: SegmentStat[];
    brand: SegmentStat[];
    region: SegmentStat[];
    dayOfWeek: SegmentStat[];
    timeOfDay: SegmentStat[];
  };
};

export type OutreachInsight = {
  source: 'llm' | 'sample';
  label: string;
  generatedAt: string;
  working: string[];
  notWorking: string[];
  bottlenecks: string[];
  nextSteps: string[];
  proposedVariants: Array<{ touchpoint: TouchpointId; hypothesis: string; sketch: string }>;
};

export type OutreachRange = { from: string; to: string };

export type ConversationQuery = OutreachRange & {
  touchpoint?: TouchpointId | '';
  variant?: Variant | '';
  outcome?: StopReason | '';
  q?: string;
};

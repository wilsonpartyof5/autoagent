export const DEAL_STAGES = [
  'reaching_out',
  'negotiating',
  'offer_received',
  'best_price_ready',
  'paused',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  reaching_out: 'Reaching out',
  negotiating: 'Finding your best price',
  offer_received: 'Offer received',
  best_price_ready: 'Best price ready',
  paused: 'Paused',
};

export const FUNNEL_STEPS = [
  'signup',
  'onboarding',
  'first_ask_or_shop',
  'first_car_viewed',
  'get_best_price',
  'paywall_shown',
  'subscribed',
  'first_car_added',
  'first_dealer_reply',
  'best_price_ready',
  'bought_or_won',
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_STEP_LABEL: Record<FunnelStep, string> = {
  signup: 'Signup',
  onboarding: 'Onboarding',
  first_ask_or_shop: 'First Ask or Shop chat',
  first_car_viewed: 'First car viewed',
  get_best_price: 'Get Best Price',
  paywall_shown: 'Paywall shown',
  subscribed: 'Subscribed',
  first_car_added: 'First car added',
  first_dealer_reply: 'First dealer reply',
  best_price_ready: 'Best price ready',
  bought_or_won: 'Bought or won',
};

/** Names to write on app_events.event_name when live tracking lands. */
export const FUNNEL_EVENT_NAME: Record<FunnelStep, string> = {
  signup: 'shopper.signed_up',
  onboarding: 'shopper.onboarding_completed',
  first_ask_or_shop: 'shopper.ask_or_shop',
  first_car_viewed: 'shopper.vehicle_viewed',
  get_best_price: 'shopper.get_best_price',
  paywall_shown: 'shopper.paywall_shown',
  subscribed: 'shopper.subscribed',
  first_car_added: 'shopper.deal_added',
  first_dealer_reply: 'shopper.dealer_replied',
  best_price_ready: 'shopper.best_price_ready',
  bought_or_won: 'shopper.won',
};

export type SubscriptionStatus = 'onboarding' | 'paywall_shown' | 'active' | 'canceled';

export type OutreachChannel = 'sms' | 'email' | 'voice';

export type DemoVehicle = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  condition: string;
  price: number;
  body_type: string;
  drivetrain?: string;
  transmission_type?: string;
  fuel_type?: string;
  dealer_city: string;
  dealer_state: string;
};

export type MarketComp = {
  label: string;
  price: number;
  miles: number;
  distanceMiles: number;
  daysOnMarket: number;
};

export type MarketInsight = {
  source: 'mock' | 'live';
  daysOnMarket: number;
  priceDropCount: number;
  lastDropAmount: number | null;
  comparableCount: number;
  radiusMiles: number;
  lowestCompDelta: number;
  leverageScore: number;
  citation: string;
  comps: MarketComp[];
};

export type DealerContact = {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  responded: boolean;
  channels: OutreachChannel[];
  cadence: Array<{ day: number; channel: OutreachChannel; label: string; status: 'sent' | 'scheduled' | 'replied' }>;
};

export type TranscriptMessage = {
  id: string;
  at: string;
  channel: OutreachChannel;
  direction: 'outbound' | 'inbound';
  dealerName: string;
  body: string;
};

export type OfferPoint = {
  at: string;
  dealerName: string;
  otd: number;
  vehiclePrice: number;
};

export type OtdBreakdown = {
  listedPrice: number;
  negotiatedPrice: number | null;
  docFee: number;
  tax: number;
  title: number;
  registration: number;
  otd: number | null;
};

export type AgentDecision = {
  at: string;
  action: string;
  note: string;
};

export type TimelineEvent = {
  at: string;
  label: string;
  detail: string;
};

export type ShopperDeal = {
  id: string;
  shopperId: string;
  vehicle: DemoVehicle;
  stage: DealStage;
  createdAt: string;
  lastActivityAt: string;
  lastActivityLabel: string;
  firstOutboundAt: string | null;
  firstReplyAt: string | null;
  bestPriceAt: string | null;
  won: boolean;
  isTest?: boolean;
  listedPrice: number;
  negotiatedPrice: number | null;
  bestOtd: number | null;
  savings: number | null;
  savingsPct: number | null;
  dealers: DealerContact[];
  channelSent: Record<OutreachChannel, number>;
  channelReplies: Record<OutreachChannel, number>;
  transcripts: TranscriptMessage[];
  smsSummary: string;
  emailSummary: string;
  shopperTimeline: TimelineEvent[];
  adminTimeline: TimelineEvent[];
  offers: OfferPoint[];
  otd: OtdBreakdown;
  decisions: AgentDecision[];
  nextStep: string;
  market: MarketInsight;
  llmCostUsd: number;
};

/** Pack-mix dimension. Includes the 1-car pack. */
export const PACK_MIX_SIZES = [1, 3, 5, 10] as const;

export type PackMixSize = (typeof PACK_MIX_SIZES)[number];

export type ShopperRecord = {
  id: string;
  name: string;
  email: string;
  signedUpAt: string;
  subscription: SubscriptionStatus;
  monthlyPriceUsd: number;
  /** Cars in the pack this shopper bought. Null when they have not purchased. */
  purchasedPack: PackMixSize | null;
  funnel: FunnelStep[];
  lastActivityAt: string;
  deals: ShopperDeal[];
};

export type ShopperSummary = {
  id: string;
  name: string;
  email: string;
  signedUpAt: string;
  subscription: SubscriptionStatus;
  cars: number;
  carCap: number;
  stageCounts: Record<DealStage, number>;
  totalSavings: number;
  lastActivityAt: string;
};

export type ShopperDealCard = {
  id: string;
  title: string;
  trim: string;
  condition: string;
  city: string;
  state: string;
  listedPrice: number;
  bestOtd: number | null;
  savings: number | null;
  savingsPct: number | null;
  stage: DealStage;
  lastActivityAt: string;
  lastActivityLabel: string;
  contacted: number;
  responded: number;
  channelSent: Record<OutreachChannel, number>;
  smsSummary: string;
  emailSummary: string;
  nextStep: string;
  shopperTimeline: TimelineEvent[];
  otd: OtdBreakdown;
  offers: Array<{ at: string; otd: number }>;
  won: boolean;
};

export const CAR_CAP = 10;
export const MONTHLY_PRICE_USD = 95;

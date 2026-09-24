/**
 * Negotiation domain rules.
 *
 * The server owns state changes. A model cannot update a case without an
 * AgentAction, and opening a case never writes a lead.
 */

export const NEGOTIATION_STATES = [
  'draft',
  'mandate_approved',
  'ready_for_dealer',
  'dealer_contacted',
  'awaiting_dealer',
  'awaiting_shopper',
  'offer_in_review',
  'agreed',
  'closed_won',
  'closed_lost',
  'expired',
] as const;

export type NegotiationState = (typeof NEGOTIATION_STATES)[number];

export const TERMINAL_NEGOTIATION_STATES = ['closed_won', 'closed_lost', 'expired'] as const;

export const DEALER_VISIBLE_NEGOTIATION_STATES = [
  'ready_for_dealer',
  'dealer_contacted',
  'awaiting_dealer',
  'awaiting_shopper',
  'offer_in_review',
  'agreed',
  'closed_won',
  'closed_lost',
  'expired',
] as const satisfies readonly NegotiationState[];

/** Tables a new case may write. `leads` is intentionally absent. */
export const NEGOTIATION_CASE_WRITE_TABLES = [
  'shopper_aliases',
  'vehicle_market_contexts',
  'negotiation_cases',
  'negotiation_state_events',
  'agent_actions',
  'app_events',
] as const;

const TRANSITIONS: Record<NegotiationState, readonly NegotiationState[]> = {
  draft: ['mandate_approved', 'closed_lost', 'expired'],
  mandate_approved: ['draft', 'ready_for_dealer', 'closed_lost', 'expired'],
  ready_for_dealer: ['draft', 'dealer_contacted', 'closed_lost', 'expired'],
  dealer_contacted: ['draft', 'awaiting_dealer', 'awaiting_shopper', 'closed_lost', 'expired'],
  awaiting_dealer: ['draft', 'offer_in_review', 'awaiting_shopper', 'closed_lost', 'expired'],
  awaiting_shopper: ['draft', 'awaiting_dealer', 'agreed', 'closed_lost', 'expired'],
  offer_in_review: ['draft', 'awaiting_dealer', 'awaiting_shopper', 'agreed', 'closed_lost', 'expired'],
  agreed: ['draft', 'closed_won', 'closed_lost', 'expired'],
  closed_won: [],
  closed_lost: [],
  expired: [],
};

const SHOPPER_ONLY_TARGETS = new Set<NegotiationState>(['draft', 'mandate_approved']);

export type NegotiationActor = 'shopper' | 'dealer' | 'agent' | 'system';

export type MarketPosition = 'below_market' | 'at_market' | 'above_market' | 'unknown';

export type MarketConfidence = 'low' | 'medium' | 'high';

export interface PolicyTransition {
  from: NegotiationState;
  to: NegotiationState;
}

export interface NegotiationPolicyRules {
  autonomousActions: readonly string[];
  approvalGates: readonly string[];
  piiDenyList: readonly string[];
  allowedTransitions: readonly PolicyTransition[];
}

export interface NegotiationPolicyRecord {
  id?: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  rules: NegotiationPolicyRules;
}

export interface ShopperMandateInput {
  timing?: string | null;
  maxPrice?: number | null;
  maxOtd?: number | null;
  paymentPreference?: string | null;
  downPayment?: number | null;
  financingPreference?: string | null;
  tradeIn?: string | null;
  mustHaves?: readonly string[];
  dealBreakers?: readonly string[];
  addOnTolerance?: string | null;
  questions?: readonly string[];
  travel?: string | null;
  buyNowReadiness?: string | null;
}

export interface ShopperMandate extends ShopperMandateInput {
  version: number;
  approvedAt?: string | null;
}

export interface NormalizedMarketSignals {
  listingId: string;
  askingPrice?: number | null;
  previousAskingPrice?: number | null;
  daysOnMarket?: number | null;
  mileage?: number | null;
  priceChangeCount?: number | null;
  compPrices?: readonly number[];
  compMileages?: readonly number[];
  marketAveragePrice?: number | null;
  similarListings?: number | null;
  availability?: string | null;
}

export interface VehicleMarketContextDraft {
  listingId: string;
  askingPrice: number | null;
  daysOnMarket: number | null;
  priceChangeCount: number;
  localCompCount: number;
  localMedian: number | null;
  priceVsMedian: number | null;
  mileageVsMedian: number | null;
  marketPosition: MarketPosition;
  confidence: MarketConfidence;
  featureVersion: string;
  priceChanged: boolean;
  previousAskingPrice: number | null;
  inventoryExpired: boolean;
}

export interface DealerNegotiationView {
  negotiationCaseId: string;
  shopperAlias: string;
  listingId: string;
  vin: string | null;
  dealershipId: string;
  state: NegotiationState;
  outcome: string | null;
  policyVersion: number;
  mandate: ShopperMandate | null;
  market: {
    askingPrice: number | null;
    daysOnMarket: number | null;
    localMedian: number | null;
    priceVsMedian: number | null;
    marketPosition: MarketPosition;
    confidence: MarketConfidence;
  } | null;
}

export class NegotiationRuleError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'NegotiationRuleError';
  }
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/g;
const CONTACT_KEYS = new Set(['email', 'phone', 'phonenumber', 'address', 'firstname', 'lastname']);

export const MARKET_CONTEXT_FEATURE_VERSION = 'market-context-v1';

export const POLICY_V1_RULES: NegotiationPolicyRules = {
  autonomousActions: [
    'create_negotiation_case',
    'save_shopper_mandate',
    'approve_shopper_mandate',
    'update_negotiation_state',
    'build_vehicle_market_context',
  ],
  approvalGates: [
    'accept_deal',
    'place_deposit',
    'submit_credit_application',
    'share_contact_information',
    'agree_outside_mandate',
  ],
  piiDenyList: ['email', 'phone', 'address', 'full_name'],
  allowedTransitions: Object.entries(TRANSITIONS).flatMap(([from, targets]) =>
    targets.map((to) => ({ from: from as NegotiationState, to })),
  ),
};

export function isNegotiationState(value: string): value is NegotiationState {
  return (NEGOTIATION_STATES as readonly string[]).includes(value);
}

export function isTerminalNegotiationState(state: NegotiationState): boolean {
  return (TERMINAL_NEGOTIATION_STATES as readonly string[]).includes(state);
}

export function transitionRequiresApprovedMandate(to: NegotiationState): boolean {
  return to !== 'draft' && to !== 'closed_lost' && to !== 'expired';
}

export function canTransition(from: NegotiationState, to: NegotiationState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertNegotiationTransition(input: {
  from: NegotiationState;
  to: NegotiationState;
  mandateApproved: boolean;
  policy: NegotiationPolicyRules;
}): void {
  if (!canTransition(input.from, input.to)) {
    throw new NegotiationRuleError(
      `A deal cannot move from ${input.from} to ${input.to}.`,
      'invalid_transition',
    );
  }
  const allowedByPolicy = input.policy.allowedTransitions.some(
    (edge) => edge.from === input.from && edge.to === input.to,
  );
  if (!allowedByPolicy) {
    throw new NegotiationRuleError(
      'The pinned negotiation policy does not allow this move.',
      'policy_denied',
    );
  }
  if (transitionRequiresApprovedMandate(input.to) && !input.mandateApproved) {
    throw new NegotiationRuleError(
      'Approve the shopper rules before this move.',
      'mandate_required',
    );
  }
}

export function assertGenericStateTool(to: NegotiationState): void {
  if (SHOPPER_ONLY_TARGETS.has(to)) {
    throw new NegotiationRuleError(
      'Use the mandate tools to change draft or approval.',
      'use_mandate_tool',
    );
  }
}

export function selectActivePolicy<T extends NegotiationPolicyRecord>(
  policies: readonly T[],
  at: Date,
): T | null {
  const instant = at.getTime();
  const active = policies.filter((policy) => {
    const from = Date.parse(policy.effectiveFrom);
    const to = policy.effectiveTo ? Date.parse(policy.effectiveTo) : Number.POSITIVE_INFINITY;
    return from <= instant && instant < to;
  });
  active.sort((left, right) => right.version - left.version);
  return active[0] ?? null;
}

export function redactContactText(value: string): string {
  return value.replace(EMAIL_PATTERN, '[redacted]').replace(PHONE_PATTERN, '[redacted]');
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return redactContactText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (CONTACT_KEYS.has(key.toLowerCase())) continue;
      output[key] = redactUnknown(child);
    }
    return output;
  }
  return null;
}

export function scrubMandateForDealer(mandate: ShopperMandate): ShopperMandate {
  const text = (value?: string | null) => (value ? redactContactText(value) : value);
  const list = (values?: readonly string[]) => (values ?? []).map((item) => redactContactText(item));
  return {
    ...mandate,
    timing: text(mandate.timing),
    paymentPreference: text(mandate.paymentPreference),
    financingPreference: text(mandate.financingPreference),
    tradeIn: text(mandate.tradeIn),
    addOnTolerance: text(mandate.addOnTolerance),
    travel: text(mandate.travel),
    buyNowReadiness: text(mandate.buyNowReadiness),
    mustHaves: list(mandate.mustHaves),
    dealBreakers: list(mandate.dealBreakers),
    questions: list(mandate.questions),
  };
}

export function projectCaseForDealer(input: {
  negotiationCaseId: string;
  shopperAlias: string;
  listingId: string;
  vin: string | null;
  dealershipId: string;
  state: NegotiationState;
  outcome: string | null;
  policyVersion: number;
  mandate: ShopperMandate | null;
  market: DealerNegotiationView['market'];
}): DealerNegotiationView | null {
  const visible = (DEALER_VISIBLE_NEGOTIATION_STATES as readonly string[]).includes(input.state);
  if (!visible || !input.mandate?.approvedAt) return null;
  return {
    negotiationCaseId: input.negotiationCaseId,
    shopperAlias: input.shopperAlias,
    listingId: input.listingId,
    vin: input.vin,
    dealershipId: input.dealershipId,
    state: input.state,
    outcome: input.outcome,
    policyVersion: input.policyVersion,
    mandate: scrubMandateForDealer(input.mandate),
    market: input.market,
  };
}

export function buildVehicleMarketContext(signals: NormalizedMarketSignals): VehicleMarketContextDraft {
  const compPrices = (signals.compPrices ?? []).filter((price) => Number.isFinite(price) && price > 0);
  const compMileages = (signals.compMileages ?? []).filter((miles) => Number.isFinite(miles) && miles >= 0);
  const localMedian = median(compPrices) ?? finiteOrNull(signals.marketAveragePrice);
  const mileageMedian = median(compMileages);
  const askingPrice = finiteOrNull(signals.askingPrice);
  const previousAskingPrice = finiteOrNull(signals.previousAskingPrice);
  const priceVsMedian = ratio(askingPrice, localMedian);
  const mileageVsMedian = ratio(finiteOrNull(signals.mileage), mileageMedian);
  const usedAverageOnly = compPrices.length === 0 && localMedian != null;
  return {
    listingId: signals.listingId,
    askingPrice,
    daysOnMarket: finiteOrNull(signals.daysOnMarket),
    priceChangeCount: Math.max(0, Math.trunc(signals.priceChangeCount ?? 0)),
    localCompCount: compPrices.length > 0 ? compPrices.length : Math.max(0, Math.trunc(signals.similarListings ?? 0)),
    localMedian,
    priceVsMedian,
    mileageVsMedian,
    marketPosition: position(priceVsMedian),
    confidence: confidence(compPrices.length, usedAverageOnly),
    featureVersion: MARKET_CONTEXT_FEATURE_VERSION,
    priceChanged: previousAskingPrice != null && askingPrice != null && previousAskingPrice !== askingPrice,
    previousAskingPrice,
    inventoryExpired: signals.availability === 'sold' || signals.availability === 'unavailable',
  };
}

export interface ListingMarketSource {
  id: string;
  price?: number | null;
  daysOnMarket?: number | null;
  mileage?: number | null;
  availability?: string | null;
  priceChangeCount?: number | null;
  marketAveragePrice?: number | null;
  similarListings?: number | null;
  compPrices?: readonly number[];
  compMileages?: readonly number[];
  previousAskingPrice?: number | null;
}

export function signalsFromListing(listing: ListingMarketSource): NormalizedMarketSignals {
  return {
    listingId: listing.id,
    askingPrice: listing.price,
    previousAskingPrice: listing.previousAskingPrice,
    daysOnMarket: listing.daysOnMarket,
    mileage: listing.mileage,
    priceChangeCount: listing.priceChangeCount,
    compPrices: listing.compPrices,
    compMileages: listing.compMileages,
    marketAveragePrice: listing.marketAveragePrice,
    similarListings: listing.similarListings,
    availability: listing.availability,
  };
}

export function makeShopperAliasCode(randomByte: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 5; index += 1) {
    code += alphabet[randomByte() % alphabet.length];
  }
  return code;
}

export type NegotiationEventName =
  | 'negotiation_created'
  | 'shopper_mandate_approved'
  | 'negotiation_state_changed'
  | 'vehicle_price_changed'
  | 'inventory_expired';

export interface NegotiationEventDraft {
  eventName: NegotiationEventName;
  properties: Record<string, unknown>;
}

export function buildNegotiationEvents(input: {
  negotiationCaseId: string;
  consumerUserId: string;
  listingId: string;
  vin: string | null;
  dealershipId: string;
  policyVersion: number;
  from: NegotiationState | null;
  to: NegotiationState;
  includeCreated: boolean;
  includeMandateApproved: boolean;
  market: VehicleMarketContextDraft | null;
}): NegotiationEventDraft[] {
  const shared = {
    consumer_user_id: input.consumerUserId,
    negotiation_case_id: input.negotiationCaseId,
    listing_id: input.listingId,
    vin: input.vin,
    dealership_id: input.dealershipId,
    policy_version: input.policyVersion,
  };
  const events: NegotiationEventDraft[] = [];
  if (input.includeCreated) {
    events.push({ eventName: 'negotiation_created', properties: { ...shared } });
  }
  events.push({
    eventName: 'negotiation_state_changed',
    properties: { ...shared, from_state: input.from, to_state: input.to },
  });
  if (input.includeMandateApproved) {
    events.push({ eventName: 'shopper_mandate_approved', properties: { ...shared } });
  }
  if (input.market?.priceChanged) {
    events.push({
      eventName: 'vehicle_price_changed',
      properties: {
        ...shared,
        previous_price: input.market.previousAskingPrice,
        asking_price: input.market.askingPrice,
      },
    });
  }
  if (input.market?.inventoryExpired) {
    events.push({ eventName: 'inventory_expired', properties: { ...shared } });
  }
  return events.map((event) => ({
    eventName: event.eventName,
    properties: redactUnknown(event.properties) as Record<string, unknown>,
  }));
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2;
  return sorted[middle];
}

function ratio(value: number | null, baseline: number | null): number | null {
  if (value == null || baseline == null || baseline === 0) return null;
  return (value - baseline) / baseline;
}

function position(priceVsMedian: number | null): MarketPosition {
  if (priceVsMedian == null) return 'unknown';
  if (priceVsMedian <= -0.03) return 'below_market';
  if (priceVsMedian >= 0.03) return 'above_market';
  return 'at_market';
}

function confidence(compCount: number, usedAverageOnly: boolean): MarketConfidence {
  if (compCount >= 5) return 'high';
  if (compCount >= 2) return 'medium';
  if (usedAverageOnly) return 'low';
  return 'low';
}

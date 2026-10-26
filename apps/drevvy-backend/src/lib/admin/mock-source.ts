import demoVehicles from './fixtures/demo-vehicles.json';
import { mockMarketInsight } from './market';
import {
  CAR_CAP,
  DEAL_STAGES,
  MONTHLY_PRICE_USD,
  type DealStage,
  type PackMixSize,
  type DealerContact,
  type DemoVehicle,
  type FunnelStep,
  type OutreachChannel,
  type ShopperDeal,
  type ShopperDealCard,
  type ShopperRecord,
  type ShopperSummary,
  type SubscriptionStatus,
  type TimelineEvent,
} from './types';

export const DEMO_VEHICLES = demoVehicles as DemoVehicle[];

const DEALERS = [
  { name: 'Piedmont Auto Group', city: 'Rock Hill', state: 'SC', phone: '803-555-0142', email: 'desk@piedmont.example' },
  { name: 'Catawba Motor Co', city: 'Fort Mill', state: 'SC', phone: '803-555-0177', email: 'sales@catawba.example' },
  { name: 'York Road Motors', city: 'Charlotte', state: 'NC', phone: '704-555-0194', email: 'team@yorkroad.example' },
  { name: 'Lake Wylie Cars', city: 'Lake Wylie', state: 'SC', phone: '803-555-0118', email: 'hello@lakewylie.example' },
] as const;

type Assignment = {
  shopperId: string;
  vehicleIndex: number;
  stage: DealStage;
  dealerCount: number;
  replies: number;
  discountRate: number | null;
  won?: boolean;
};

const SHOPPER_SEEDS: Array<{
  id: string;
  name: string;
  email: string;
  signedUpAt: string;
  subscription: SubscriptionStatus;
  purchasedPack: PackMixSize | null;
  funnel: FunnelStep[];
}> = [
  {
    id: 'shopper-maya',
    name: 'Maya Chen',
    email: 'maya.chen@example.com',
    signedUpAt: '2026-08-12T15:04:00.000Z',
    subscription: 'active',
    purchasedPack: 10,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown', 'subscribed', 'first_car_added', 'first_dealer_reply', 'best_price_ready', 'bought_or_won'],
  },
  {
    id: 'shopper-jordan',
    name: 'Jordan Blake',
    email: 'jordan.blake@example.com',
    signedUpAt: '2026-09-02T18:22:00.000Z',
    subscription: 'active',
    purchasedPack: 5,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown', 'subscribed', 'first_car_added', 'first_dealer_reply'],
  },
  {
    id: 'shopper-priya',
    name: 'Priya Shah',
    email: 'priya.shah@example.com',
    signedUpAt: '2026-09-20T13:10:00.000Z',
    subscription: 'paywall_shown',
    purchasedPack: null,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown'],
  },
  {
    id: 'shopper-chris',
    name: 'Chris Alvarez',
    email: 'chris.alvarez@example.com',
    signedUpAt: '2026-07-18T11:40:00.000Z',
    subscription: 'active',
    purchasedPack: 5,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown', 'subscribed', 'first_car_added', 'first_dealer_reply', 'best_price_ready'],
  },
  {
    id: 'shopper-elena',
    name: 'Elena Brooks',
    email: 'elena.brooks@example.com',
    signedUpAt: '2026-06-01T16:05:00.000Z',
    subscription: 'canceled',
    purchasedPack: 10,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown', 'subscribed', 'first_car_added', 'first_dealer_reply', 'best_price_ready'],
  },
  {
    id: 'shopper-sam',
    name: 'Sam Okonkwo',
    email: 'sam.okonkwo@example.com',
    signedUpAt: '2026-09-08T20:15:00.000Z',
    subscription: 'active',
    purchasedPack: 1,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown', 'subscribed', 'first_car_added', 'first_dealer_reply', 'best_price_ready'],
  },
  {
    id: 'shopper-riley',
    name: 'Riley Nguyen',
    email: 'riley.nguyen@example.com',
    signedUpAt: '2026-09-28T09:30:00.000Z',
    subscription: 'onboarding',
    purchasedPack: null,
    funnel: ['signup'],
  },
  {
    id: 'shopper-avery',
    name: 'Avery Kim',
    email: 'avery.kim@example.com',
    signedUpAt: '2026-09-25T17:45:00.000Z',
    subscription: 'active',
    purchasedPack: 25,
    funnel: ['signup', 'onboarding', 'first_ask_or_shop', 'first_car_viewed', 'get_best_price', 'paywall_shown', 'subscribed', 'first_car_added', 'first_dealer_reply'],
  },
];

const ASSIGNMENTS: Assignment[] = [
  { shopperId: 'shopper-chris', vehicleIndex: 0, stage: 'reaching_out', dealerCount: 3, replies: 0, discountRate: null },
  { shopperId: 'shopper-chris', vehicleIndex: 1, stage: 'reaching_out', dealerCount: 2, replies: 0, discountRate: null },
  { shopperId: 'shopper-chris', vehicleIndex: 2, stage: 'negotiating', dealerCount: 3, replies: 1, discountRate: null },
  { shopperId: 'shopper-chris', vehicleIndex: 3, stage: 'negotiating', dealerCount: 4, replies: 2, discountRate: null },
  { shopperId: 'shopper-chris', vehicleIndex: 4, stage: 'negotiating', dealerCount: 3, replies: 1, discountRate: null },
  { shopperId: 'shopper-chris', vehicleIndex: 5, stage: 'offer_received', dealerCount: 3, replies: 2, discountRate: 0.06 },
  { shopperId: 'shopper-chris', vehicleIndex: 6, stage: 'offer_received', dealerCount: 4, replies: 3, discountRate: 0.05 },
  { shopperId: 'shopper-chris', vehicleIndex: 7, stage: 'best_price_ready', dealerCount: 4, replies: 3, discountRate: 0.11 },
  { shopperId: 'shopper-chris', vehicleIndex: 8, stage: 'best_price_ready', dealerCount: 3, replies: 2, discountRate: 0.09 },
  { shopperId: 'shopper-chris', vehicleIndex: 9, stage: 'paused', dealerCount: 2, replies: 1, discountRate: null },
  { shopperId: 'shopper-maya', vehicleIndex: 10, stage: 'best_price_ready', dealerCount: 3, replies: 3, discountRate: 0.12, won: true },
  { shopperId: 'shopper-maya', vehicleIndex: 11, stage: 'negotiating', dealerCount: 3, replies: 2, discountRate: null },
  { shopperId: 'shopper-maya', vehicleIndex: 12, stage: 'offer_received', dealerCount: 2, replies: 2, discountRate: 0.07 },
  { shopperId: 'shopper-maya', vehicleIndex: 13, stage: 'reaching_out', dealerCount: 3, replies: 0, discountRate: null },
  { shopperId: 'shopper-jordan', vehicleIndex: 14, stage: 'reaching_out', dealerCount: 2, replies: 0, discountRate: null },
  { shopperId: 'shopper-jordan', vehicleIndex: 15, stage: 'negotiating', dealerCount: 3, replies: 1, discountRate: null },
  { shopperId: 'shopper-elena', vehicleIndex: 16, stage: 'paused', dealerCount: 3, replies: 1, discountRate: 0.04 },
  { shopperId: 'shopper-sam', vehicleIndex: 17, stage: 'best_price_ready', dealerCount: 4, replies: 3, discountRate: 0.1 },
  { shopperId: 'shopper-avery', vehicleIndex: 18, stage: 'reaching_out', dealerCount: 2, replies: 1, discountRate: null },
];

let cached: ShopperRecord[] | null = null;

export function getMockShoppers(): ShopperRecord[] {
  if (!cached) cached = SHOPPER_SEEDS.map(buildShopper);
  return cached;
}

export function listShopperSummaries(): ShopperSummary[] {
  return getMockShoppers().map(toSummary);
}

export function getMockShopper(id: string): ShopperRecord | null {
  return getMockShoppers().find((shopper) => shopper.id === id) ?? null;
}

export function getMockDeal(dealId: string): { shopper: ShopperRecord; deal: ShopperDeal } | null {
  for (const shopper of getMockShoppers()) {
    const deal = shopper.deals.find((item) => item.id === dealId);
    if (deal) return { shopper, deal };
  }
  return null;
}

export function toShopperCard(deal: ShopperDeal): ShopperDealCard {
  return {
    id: deal.id,
    title: `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`,
    trim: deal.vehicle.trim,
    condition: deal.vehicle.condition,
    city: deal.vehicle.dealer_city,
    state: deal.vehicle.dealer_state,
    listedPrice: deal.listedPrice,
    bestOtd: deal.bestOtd,
    savings: deal.savings,
    savingsPct: deal.savingsPct,
    stage: deal.stage,
    lastActivityAt: deal.lastActivityAt,
    lastActivityLabel: deal.lastActivityLabel,
    contacted: deal.dealers.length,
    responded: deal.dealers.filter((dealer) => dealer.responded).length,
    channelSent: deal.channelSent,
    smsSummary: deal.smsSummary,
    emailSummary: deal.emailSummary,
    nextStep: deal.nextStep,
    shopperTimeline: deal.shopperTimeline,
    otd: deal.otd,
    offers: deal.offers.map((offer) => ({ at: offer.at, otd: offer.otd })),
    won: deal.won,
  };
}

export function shopperFacingJson(deal: ShopperDeal): string {
  return JSON.stringify(toShopperCard(deal));
}

function buildShopper(seed: (typeof SHOPPER_SEEDS)[number]): ShopperRecord {
  const deals = ASSIGNMENTS
    .filter((assignment) => assignment.shopperId === seed.id)
    .map(buildDeal);
  const lastActivityAt = deals.reduce((latest, deal) => (
    deal.lastActivityAt > latest ? deal.lastActivityAt : latest
  ), seed.signedUpAt);
  return {
    ...seed,
    monthlyPriceUsd: seed.subscription === 'active' ? MONTHLY_PRICE_USD : 0,
    lastActivityAt,
    deals,
  };
}

function buildDeal(assignment: Assignment): ShopperDeal {
  const vehicle = DEMO_VEHICLES[assignment.vehicleIndex];
  if (!vehicle) throw new Error(`Missing demo vehicle ${assignment.vehicleIndex}`);
  const createdAt = shift(vehicle.vin, -10 - (assignment.vehicleIndex % 5));
  const hasOffer = assignment.discountRate != null && (assignment.stage === 'offer_received' || assignment.stage === 'best_price_ready' || assignment.stage === 'paused');
  const negotiatedPrice = hasOffer ? Math.round(vehicle.price * (1 - (assignment.discountRate ?? 0))) : null;
  const otd = priceOtd(vehicle.price, negotiatedPrice);
  const savings = negotiatedPrice == null ? null : vehicle.price - negotiatedPrice;
  const savingsPct = savings == null ? null : savings / vehicle.price;
  const dealers = buildDealers(vehicle, assignment);
  const transcripts = buildTranscripts(vehicle, dealers, createdAt);
  const firstOutboundAt = transcripts.find((message) => message.direction === 'outbound')?.at ?? null;
  const firstReplyAt = transcripts.find((message) => message.direction === 'inbound')?.at ?? null;
  const bestPriceAt = assignment.stage === 'best_price_ready' ? shiftFrom(createdAt, 6) : null;
  const lastActivityAt = firstReplyAt ?? firstOutboundAt ?? createdAt;
  const offers = buildOffers(dealers, negotiatedPrice, otd.otd, createdAt);
  const channelSent = countChannels(dealers, 'sent');
  const channelReplies = countChannels(dealers, 'replied');
  const messageCount = transcripts.length;
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return {
    id: `deal-${vehicle.vin.slice(0, 8).toLowerCase()}`,
    shopperId: assignment.shopperId,
    vehicle,
    stage: assignment.stage,
    createdAt,
    lastActivityAt,
    lastActivityLabel: activityLabel(assignment.stage, dealers),
    firstOutboundAt,
    firstReplyAt,
    bestPriceAt,
    won: Boolean(assignment.won),
    listedPrice: vehicle.price,
    negotiatedPrice,
    bestOtd: otd.otd,
    savings,
    savingsPct,
    dealers,
    channelSent,
    channelReplies,
    transcripts,
    smsSummary: assignment.replies > 0
      ? `Texts on the ${title} are waiting on a written out-the-door number. ${assignment.replies} store${assignment.replies === 1 ? '' : 's'} replied.`
      : `Intro texts are out for the ${title}. No store has answered yet.`,
    emailSummary: hasOffer
      ? `Email threads include an itemized out-the-door quote. The best vehicle price is ${usd(negotiatedPrice ?? vehicle.price)} before tax and fees.`
      : `Emails asked each store for doc fees, tax, and the out-the-door total. Quotes are still incomplete.`,
    shopperTimeline: shopperTimeline(title, assignment.stage, createdAt, firstReplyAt, bestPriceAt),
    adminTimeline: adminTimeline(dealers, createdAt, firstReplyAt),
    offers,
    otd,
    decisions: decisions(assignment, dealers),
    nextStep: nextStep(assignment.stage, assignment.won),
    market: mockMarketInsight(vehicle),
    llmCostUsd: Math.round((messageCount * 0.03 + channelSent.voice * 0.11) * 100) / 100,
  };
}

function buildDealers(vehicle: DemoVehicle, assignment: Assignment): DealerContact[] {
  return DEALERS.slice(0, assignment.dealerCount).map((dealer, index) => {
    const responded = index < assignment.replies;
    const cadence = [
      { day: 0, channel: 'sms' as const, label: 'Intro text', status: 'sent' as const },
      { day: 0, channel: 'email' as const, label: 'OTD email', status: (responded ? 'replied' : 'sent') as 'sent' | 'replied' },
      { day: 1, channel: 'voice' as const, label: 'Follow-up call', status: (responded ? 'replied' : index === 0 ? 'sent' : 'scheduled') as 'sent' | 'scheduled' | 'replied' },
      { day: 3, channel: 'sms' as const, label: 'Price check', status: (responded ? 'replied' : 'scheduled') as 'sent' | 'scheduled' | 'replied' },
    ];
    return {
      id: `${vehicle.vin}-${index}`,
      ...dealer,
      responded,
      channels: responded ? ['sms', 'email', 'voice'] : ['sms', 'email'],
      cadence,
    };
  });
}

function buildTranscripts(vehicle: DemoVehicle, dealers: DealerContact[], createdAt: string) {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const messages = [];
  for (const dealer of dealers) {
    messages.push({
      id: `${dealer.id}-sms-out`,
      at: createdAt,
      channel: 'sms' as const,
      direction: 'outbound' as const,
      dealerName: dealer.name,
      body: `Hi, this is Drevvy, working for the shopper. Can you send the out-the-door price on the ${title}, stock matching VIN ${vehicle.vin}?`,
    });
    messages.push({
      id: `${dealer.id}-email-out`,
      at: shiftFrom(createdAt, 0),
      channel: 'email' as const,
      direction: 'outbound' as const,
      dealerName: dealer.name,
      body: `Please itemize selling price, doc fee, tax, title, and any add-ons for the ${title}. The shopper is comparing out-the-door totals only.`,
    });
    if (dealer.responded) {
      messages.push({
        id: `${dealer.id}-sms-in`,
        at: shiftFrom(createdAt, 1),
        channel: 'sms' as const,
        direction: 'inbound' as const,
        dealerName: dealer.name,
        body: `We can work the ${title}. I'll email the fee breakdown this afternoon. Are they financing or paying cash?`,
      });
    }
  }
  return messages;
}

function buildOffers(
  dealers: DealerContact[],
  negotiatedPrice: number | null,
  otd: number | null,
  createdAt: string,
) {
  if (negotiatedPrice == null || otd == null) return [];
  const responding = dealers.filter((dealer) => dealer.responded);
  return responding.slice(0, 3).map((dealer, index) => ({
    at: shiftFrom(createdAt, 2 + index),
    dealerName: dealer.name,
    vehiclePrice: negotiatedPrice + index * 350,
    otd: otd + index * 350,
  }));
}

function priceOtd(listed: number, negotiated: number | null) {
  if (negotiated == null) {
    return { listedPrice: listed, negotiatedPrice: null, docFee: 499, tax: 0, title: 250, registration: 150, otd: null };
  }
  const docFee = 499;
  const title = 250;
  const registration = 150;
  const tax = Math.round(negotiated * 0.05);
  return {
    listedPrice: listed,
    negotiatedPrice: negotiated,
    docFee,
    tax,
    title,
    registration,
    otd: negotiated + docFee + tax + title + registration,
  };
}

function shopperTimeline(title: string, stage: DealStage, createdAt: string, firstReplyAt: string | null, bestPriceAt: string | null): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { at: createdAt, label: 'Added to the agent', detail: `${title} is one of the cars Drevvy is pricing.` },
    { at: createdAt, label: 'Outreach started', detail: 'Drevvy contacted dealerships by text and email. Store names stay hidden.' },
  ];
  if (firstReplyAt) {
    events.push({ at: firstReplyAt, label: 'A dealership replied', detail: 'A store answered and asked how the shopper plans to pay.' });
  }
  if (stage === 'offer_received' || stage === 'best_price_ready') {
    events.push({ at: shiftFrom(createdAt, 3), label: 'Offer received', detail: 'An out-the-door quote is in. Fees are split out on this car.' });
  }
  if (bestPriceAt) {
    events.push({ at: bestPriceAt, label: 'Best price ready', detail: 'This is the lowest out-the-door total so far.' });
  }
  if (stage === 'paused') {
    events.push({ at: shiftFrom(createdAt, 4), label: 'Paused', detail: 'Outreach is paused. No new texts or calls will go out.' });
  }
  return events;
}

function adminTimeline(dealers: DealerContact[], createdAt: string, firstReplyAt: string | null): TimelineEvent[] {
  const events: TimelineEvent[] = dealers.flatMap((dealer) => ([
    { at: createdAt, label: `SMS to ${dealer.name}`, detail: dealer.phone },
    { at: createdAt, label: `Email to ${dealer.name}`, detail: dealer.email },
  ]));
  if (firstReplyAt) {
    const responder = dealers.find((dealer) => dealer.responded);
    if (responder) {
      events.push({ at: firstReplyAt, label: `Reply from ${responder.name}`, detail: 'Asked about cash versus financing.' });
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

function decisions(assignment: Assignment, dealers: DealerContact[]) {
  const notes = [
    { at: '2026-10-02T15:00:00.000Z', action: 'open_outreach', note: `Contact ${dealers.length} stores. Do not show their names to the shopper.` },
  ];
  if (assignment.replies === 0) {
    notes.push({ at: '2026-10-04T15:00:00.000Z', action: 'schedule_voice', note: 'No reply after day 0. Queue a voice call on day 1.' });
  } else if (assignment.stage === 'best_price_ready') {
    notes.push({ at: '2026-10-05T15:00:00.000Z', action: 'mark_best_price', note: 'Stop new outreach. Show the shopper the best out-the-door total.' });
  } else {
    notes.push({ at: '2026-10-04T18:00:00.000Z', action: 'counter', note: 'Ask the responding store to match the lower comp before calling the next store.' });
  }
  return notes;
}

function nextStep(stage: DealStage, won?: boolean): string {
  if (won) return 'Shopper accepted the price. Hand off the store contact only after they confirm they want to buy.';
  if (stage === 'paused') return 'Wait for the shopper to resume. Do not text or call.';
  if (stage === 'best_price_ready') return 'Present the best out-the-door total and ask if they want to move forward.';
  if (stage === 'offer_received') return 'Compare the quotes and send one counter to the lowest store.';
  if (stage === 'negotiating') return 'Call the stores that have not answered and restate the out-the-door ask.';
  return 'Send the day-1 voice follow-up to stores that have not replied.';
}

function activityLabel(stage: DealStage, dealers: DealerContact[]): string {
  const replies = dealers.filter((dealer) => dealer.responded).length;
  if (stage === 'paused') return 'Outreach paused';
  if (stage === 'best_price_ready') return 'Best out-the-door price is ready';
  if (replies === 0) return `Contacted ${dealers.length} dealerships`;
  return `${replies} of ${dealers.length} dealerships replied`;
}

function countChannels(dealers: DealerContact[], kind: 'sent' | 'replied'): Record<OutreachChannel, number> {
  const counts: Record<OutreachChannel, number> = { sms: 0, email: 0, voice: 0 };
  for (const dealer of dealers) {
    for (const step of dealer.cadence) {
      if (kind === 'sent' && step.status !== 'scheduled') counts[step.channel] += 1;
      if (kind === 'replied' && step.status === 'replied') counts[step.channel] += 1;
    }
  }
  return counts;
}

function toSummary(shopper: ShopperRecord): ShopperSummary {
  const stageCounts = Object.fromEntries(DEAL_STAGES.map((stage) => [stage, 0])) as ShopperSummary['stageCounts'];
  for (const deal of shopper.deals) stageCounts[deal.stage] += 1;
  return {
    id: shopper.id,
    name: shopper.name,
    email: shopper.email,
    signedUpAt: shopper.signedUpAt,
    subscription: shopper.subscription,
    cars: shopper.deals.length,
    carCap: CAR_CAP,
    stageCounts,
    totalSavings: shopper.deals.reduce((sum, deal) => sum + (deal.savings ?? 0), 0),
    lastActivityAt: shopper.lastActivityAt,
  };
}

function shift(seed: string, days: number): string {
  const base = Date.parse('2026-09-20T15:00:00.000Z') + (hash(seed) % 5) * 3600_000;
  return new Date(base + days * 86_400_000).toISOString();
}

function shiftFrom(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function hash(value: string): number {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

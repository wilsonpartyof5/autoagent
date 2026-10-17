import { getMockShoppers } from './mock-source';
import {
  CAR_CAP,
  DEAL_STAGES,
  FUNNEL_STEPS,
  MONTHLY_PRICE_USD,
  PACK_MIX_SIZES,
  type DealStage,
  type PackMixSize,
  type FunnelStep,
  type OutreachChannel,
  type ShopperRecord,
} from './types';

export type AdminAnalytics = {
  funnel: Array<{ step: FunnelStep; count: number }>;
  dealsByStage: Array<{ stage: DealStage; count: number }>;
  averageSavingsUsd: number | null;
  averageSavingsPct: number | null;
  medianHoursToFirstReply: number | null;
  medianHoursToBestPrice: number | null;
  responseRateByChannel: Array<{ channel: OutreachChannel; sent: number; replies: number; rate: number | null }>;
  cadenceReplyRate: number | null;
  messagesPerDeal: number | null;
  activeCars: number;
  subscribersAtCap: number;
  activeSubscribers: number;
  mrrUsd: number;
  churnedSubscribers: number;
  churnNote: string;
  llmCostPerDeal: number | null;
  totalLlmCostUsd: number;
  packMix: Array<{ size: PackMixSize; purchases: number }>;
};

export function buildAnalytics(shoppers: ShopperRecord[] = getMockShoppers()): AdminAnalytics {
  const deals = shoppers.flatMap((shopper) => shopper.deals).filter((deal) => deal.isTest !== true);
  const withSavings = deals.filter((deal) => deal.savings != null && deal.savingsPct != null);
  const replyHours = deals
    .map((deal) => hoursBetween(deal.firstOutboundAt, deal.firstReplyAt))
    .filter((hours): hours is number => hours != null);
  const bestPriceHours = deals
    .map((deal) => hoursBetween(deal.createdAt, deal.bestPriceAt))
    .filter((hours): hours is number => hours != null);
  const channels: OutreachChannel[] = ['sms', 'email', 'voice'];
  const activeSubscribers = shoppers.filter((shopper) => shopper.subscription === 'active');
  const churned = shoppers.filter((shopper) => shopper.subscription === 'canceled').length;

  return {
    funnel: FUNNEL_STEPS.map((step) => ({
      step,
      count: shoppers.filter((shopper) => shopper.funnel.includes(step)).length,
    })),
    dealsByStage: DEAL_STAGES.map((stage) => ({
      stage,
      count: deals.filter((deal) => deal.stage === stage).length,
    })),
    averageSavingsUsd: average(withSavings.map((deal) => deal.savings ?? 0)),
    averageSavingsPct: average(withSavings.map((deal) => (deal.savingsPct ?? 0) * 100)),
    medianHoursToFirstReply: median(replyHours),
    medianHoursToBestPrice: median(bestPriceHours),
    responseRateByChannel: channels.map((channel) => {
      const sent = deals.reduce((sum, deal) => sum + deal.channelSent[channel], 0);
      const replies = deals.reduce((sum, deal) => sum + deal.channelReplies[channel], 0);
      return { channel, sent, replies, rate: sent === 0 ? null : replies / sent };
    }),
    cadenceReplyRate: (() => {
      const steps = deals.flatMap((deal) => deal.dealers.flatMap((dealer) => dealer.cadence));
      const sent = steps.filter((step) => step.status !== 'scheduled').length;
      const replied = steps.filter((step) => step.status === 'replied').length;
      return sent === 0 ? null : replied / sent;
    })(),
    messagesPerDeal: deals.length === 0 ? null : deals.reduce((sum, deal) => sum + deal.transcripts.length, 0) / deals.length,
    activeCars: activeSubscribers.reduce((sum, shopper) => sum + shopper.deals.length, 0),
    subscribersAtCap: activeSubscribers.filter((shopper) => shopper.deals.length >= CAR_CAP).length,
    activeSubscribers: activeSubscribers.length,
    mrrUsd: activeSubscribers.length * MONTHLY_PRICE_USD,
    churnedSubscribers: churned,
    churnNote: 'Placeholder until Stripe (or the payment provider) reports real cancellations. This count is canceled mock subscriptions only.',
    llmCostPerDeal: deals.length === 0 ? null : deals.reduce((sum, deal) => sum + deal.llmCostUsd, 0) / deals.length,
    totalLlmCostUsd: deals.reduce((sum, deal) => sum + deal.llmCostUsd, 0),
    packMix: PACK_MIX_SIZES.map((size) => ({
      size,
      purchases: shoppers.filter((shopper) => shopper.purchasedPack === size).length,
    })),
  };
}

function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return (Date.parse(end) - Date.parse(start)) / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

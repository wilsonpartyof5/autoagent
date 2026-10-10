import { DEAL_STAGE_LABEL, type DealStage, type SubscriptionStatus } from './types';

export function usd(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function pct(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${rate.toFixed(rate > 1 ? 0 : 1)}%`;
}

export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date(iso));
}

export function stageLabel(stage: DealStage): string {
  return DEAL_STAGE_LABEL[stage];
}

export function subscriptionLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Subscribed';
    case 'canceled':
      return 'Canceled';
    case 'paywall_shown':
      return 'Paywall shown';
    case 'onboarding':
      return 'Onboarding';
    default:
      return status;
  }
}

export function hours(value: number | null): string {
  if (value == null) return '—';
  if (value < 48) return `${Math.round(value)}h`;
  return `${Math.round(value / 24)}d`;
}

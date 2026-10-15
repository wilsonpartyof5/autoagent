import { DEAL_STAGE_LABEL, type DealStage, type SubscriptionStatus } from './types';

export function usd(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

/** Dollar format with cents, for bills and cost-model figures such as $0.73. */
export function dollars(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, mon - 1, 1)));
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

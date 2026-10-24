import type {
  AnalyticsRange,
  Conversation,
  ConversationStage,
  InboxFilter,
  InboxItem,
  ReplyTemplate,
  SlaChip,
} from './types';

export const STAGE_LABEL: Record<ConversationStage, string> = {
  new_request: 'New request',
  in_conversation: 'In conversation',
  numbers_shared: 'Numbers shared',
  closed: 'Closed',
  car_sold: 'Car sold',
  no_reply: 'No reply',
};

export const STAGE_PATH: ConversationStage[] = [
  'new_request',
  'in_conversation',
  'numbers_shared',
];

export const STAGE_ENDS: ConversationStage[] = [
  'closed',
  'car_sold',
  'no_reply',
];

export const FILTER_LABEL: Record<InboxFilter, string> = {
  needs_reply: 'Needs reply',
  all_open: 'All open',
  closed: 'Closed',
};

export const RANGE_LABEL: Record<AnalyticsRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export const SHARE_NUMBERS_DISCLAIMER =
  'Informational for this anonymous shopper. Not a binding offer.';

const MAX_CENTS = 200_000_000;

export function isOpenStage(stage: ConversationStage): boolean {
  return (
    stage === 'new_request' ||
    stage === 'in_conversation' ||
    stage === 'numbers_shared'
  );
}

export function isInboxFilter(value: string): value is InboxFilter {
  return value === 'needs_reply' || value === 'all_open' || value === 'closed';
}

export function isAnalyticsRange(value: string): value is AnalyticsRange {
  return value === '7d' || value === '30d' || value === '90d';
}

export function isConversationStage(value: string): value is ConversationStage {
  return value in STAGE_LABEL;
}

export function shopperDisplayName(firstName: string | null): string {
  const trimmed = firstName?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : 'Anonymous shopper';
}

export function vehicleTitle(vehicle: Conversation['vehicle']): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
}

export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const dollars = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = negative ? '-' : '';
  if (remainder === 0) return `${sign}$${grouped}`;
  return `${sign}$${grouped}.${remainder.toString().padStart(2, '0')}`;
}

export function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ''] = trimmed.split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > MAX_CENTS) {
    return null;
  }
  return cents;
}

export function validCents(value: number): boolean {
  return Number.isInteger(value) && value >= 100 && value <= MAX_CENTS;
}

export function pricesDiffer(
  advertisedPriceCents: number,
  statedPriceCents: number | null
): boolean {
  return statedPriceCents != null && statedPriceCents !== advertisedPriceCents;
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${hours}:${minutes} UTC`;
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.round(rounded / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function needsReply(conversation: Conversation): boolean {
  if (!isOpenStage(conversation.stage)) return false;
  const last = conversation.messages[conversation.messages.length - 1];
  return last?.author === 'shopper';
}

export function snippetFrom(conversation: Conversation): string {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return '';
  const flat = last.body.replace(/\s+/g, ' ').trim();
  if (flat.length <= 140) return flat;
  return `${flat.slice(0, 139)}…`;
}

export function slaChip(
  conversation: Pick<
    Conversation,
    'openedAt' | 'firstReplyAt' | 'replyDueAt' | 'stage' | 'messages'
  >,
  now: Date
): SlaChip {
  if (!needsReply(conversation as Conversation) && conversation.firstReplyAt) {
    const minutes =
      (Date.parse(conversation.firstReplyAt) -
        Date.parse(conversation.openedAt)) /
      60_000;
    return {
      label: `Replied in ${formatDuration(minutes)}`,
      tone: 'replied',
    };
  }
  if (!needsReply(conversation as Conversation)) {
    return { label: 'No reply yet', tone: 'ended' };
  }
  const deltaMinutes =
    (Date.parse(conversation.replyDueAt) - now.getTime()) / 60_000;
  if (deltaMinutes >= 0) {
    return { label: `${formatDuration(deltaMinutes)} left`, tone: 'waiting' };
  }
  return { label: `${formatDuration(-deltaMinutes)} over`, tone: 'overdue' };
}

export function replyTemplates(conversation: {
  stockNumber: string;
  advertisedPriceCents: number;
}): ReplyTemplate[] {
  return [
    {
      id: 'available',
      label: 'Still available',
      text: `Yes, stock #${conversation.stockNumber} is still here.`,
    },
    {
      id: 'sold',
      label: 'Car sold',
      text: `Stock #${conversation.stockNumber} has sold.`,
    },
    {
      id: 'advertised',
      label: 'Advertised price',
      text: `The advertised price is ${formatMoney(conversation.advertisedPriceCents)}. I can share a written out-the-door total in this chat.`,
    },
  ];
}

export function numbersShareBody(input: {
  advertisedPriceCents: number;
  statedPriceCents: number;
  writtenOtdCents: number | null;
  note: string;
}): string {
  const lines = [
    'Shared numbers in this chat. Informational, not a binding offer.',
    `Advertised price: ${formatMoney(input.advertisedPriceCents)}`,
    `Price I state: ${formatMoney(input.statedPriceCents)}`,
  ];
  if (input.writtenOtdCents != null) {
    lines.push(
      `Written out-the-door total: ${formatMoney(input.writtenOtdCents)}`
    );
  }
  const note = input.note.trim();
  if (note) lines.push(note);
  return lines.join('\n');
}

export function matchesInboxFilter(
  item: Pick<InboxItem, 'needsReply' | 'stage'>,
  filter: InboxFilter
): boolean {
  if (filter === 'needs_reply') return item.needsReply;
  if (filter === 'all_open') return isOpenStage(item.stage);
  return !isOpenStage(item.stage);
}

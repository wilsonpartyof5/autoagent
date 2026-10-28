import { getOutreachDeals } from './mock-source';
import {
  CALL_OUTCOMES,
  CHANNELS,
  MIN_VARIANT_SENDS,
  STOP_REASONS,
  TOUCHPOINT_IDS,
  VARIANTS,
  type CallOutcome,
  type OutreachChannel,
  type OutreachDeal,
  type OutreachEvent,
  type OutreachReport,
  type SegmentStat,
  type StopReason,
  type TouchpointId,
  type Variant,
  type VariantStat,
} from './types';

const SENT = new Set(['sent', 'delivered']);

export function dealsStartedBetween(from: string, to: string, deals = getOutreachDeals()): OutreachDeal[] {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T23:59:59.999Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return deals.filter((deal) => {
    const at = Date.parse(deal.startedAt);
    return at >= lo && at <= hi;
  });
}

export function withoutTestTraffic(deals: OutreachDeal[]): OutreachDeal[] {
  return deals.flatMap((deal) => {
    if (deal.isTest) return [];
    const events = deal.events.filter((event) => event.isTest !== true);
    if (deal.events.length > 0 && events.length === 0) return [];
    return [{ ...deal, events }];
  });
}

export function buildOutreachReport(from: string, to: string, deals = dealsStartedBetween(from, to)): OutreachReport {
  const liveDeals = withoutTestTraffic(deals);
  const outbound = liveDeals.flatMap((deal) => deal.events.filter(isSentOutbound));
  const calls = outbound.filter((event) => event.channel === 'call');
  const connected = calls.filter((event) => event.callOutcome && !['no_answer', 'voicemail'].includes(event.callOutcome));
  const captured = connected.filter((event) => event.callOutcome === 'number_captured');
  const replyHours = liveDeals
    .filter((deal) => deal.firstReplyAt)
    .map((deal) => hoursBetween(deal.startedAt, deal.firstReplyAt as string));

  const replied = liveDeals.filter((deal) => deal.replyWithin7Days).length;
  const opted = liveDeals.filter((deal) => deal.stop === 'opt_out').length;
  const sold = liveDeals.filter((deal) => deal.stop === 'sold').length;
  const withOtd = liveDeals.filter((deal) => deal.otdReceived).length;
  const contacted = liveDeals.length;

  return {
    from,
    to,
    kpis: {
      dealsContacted: contacted,
      emailsSent: outbound.filter((event) => event.channel === 'email').length,
      textsSent: outbound.filter((event) => event.channel === 'sms').length,
      callsSent: calls.length,
      voicemailsSent: outbound.filter((event) => event.channel === 'voicemail').length,
      textsSkipped: liveDeals.flatMap((deal) => deal.events).filter((event) => event.status === 'skipped_not_textable').length,
      replyRateWithin7Days: rate(replied, contacted),
      medianHoursToFirstReply: median(replyHours),
      otdReceivedRate: rate(withOtd, contacted),
      numberCaptureRate: rate(captured.length, connected.length),
      optOutRate: rate(opted, contacted),
      soldBeforeReplyRate: rate(sold, contacted),
      endedNoResponse: deals.filter((deal) => deal.stop === 'ended_no_response').length,
    },
    firstReplyByDay: [0, 1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      count: liveDeals.filter((deal) => deal.replyWithin7Days && replyDay(deal) === day).length,
    })),
    firstReplyByTouchpoint: TOUCHPOINT_IDS.map((touchpoint) => ({
      touchpoint,
      count: liveDeals.filter((deal) => deal.firstReplyTouchpoint === touchpoint).length,
    })).filter((row) => row.count > 0),
    stops: STOP_REASONS.map((reason) => ({
      reason,
      count: liveDeals.filter((deal) => deal.stop === reason).length,
    })),
    variants: variantStats(liveDeals),
    channels: CHANNELS.map((channel) => {
      const rows = outbound.filter((event) => event.channel === channel);
      const replies = rows.filter((event) => event.replied).length;
      return { channel, sent: rows.length, replies, replyRate: rate(replies, rows.length) };
    }),
    callOutcomes: CALL_OUTCOMES.map((outcome) => {
      const rows = calls.filter((event) => event.callOutcome === outcome);
      const durations = rows.map((event) => event.callDurationS).filter((value): value is number => value != null);
      return { outcome, count: rows.length, avgDurationS: durations.length ? Math.round(mean(durations)) : null };
    }),
    avgCallDurationS: calls.some((event) => event.callDurationS != null)
      ? Math.round(mean(calls.map((event) => event.callDurationS).filter((value): value is number => value != null)))
      : null,
    segments: {
      dealerType: dealSegments(liveDeals, (deal) => deal.dealerType),
      brand: dealSegments(liveDeals, (deal) => deal.brand),
      region: dealSegments(liveDeals, (deal) => deal.region),
      dayOfWeek: sendSegments(outbound, (event) => event.dayOfWeek, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
      timeOfDay: sendSegments(outbound, (event) => (hourOf(event) < 12 ? 'Morning' : 'Afternoon'), ['Morning', 'Afternoon']),
    },
  };
}

function variantStats(deals: OutreachDeal[]): VariantStat[] {
  const sent = deals.flatMap((deal) => deal.events.filter(isSentOutbound));
  const stats: VariantStat[] = [];
  for (const touchpoint of TOUCHPOINT_IDS) {
    const arm = VARIANTS.map((variant) => {
      const rows = sent.filter((event) => event.touchpoint === touchpoint && event.variant === variant);
      const replies = rows.filter((event) => event.replied);
      const sends = rows.length;
      const enoughData = sends >= MIN_VARIANT_SENDS;
      const ci = enoughData ? wilson(replies.length, sends) : null;
      const row: VariantStat = {
        touchpoint,
        variant,
        sends,
        replies: replies.length,
        replyRate: rate(replies.length, sends),
        ciLow: ci?.low ?? null,
        ciHigh: ci?.high ?? null,
        enoughData,
        medianHoursToReply: median(replies.map((event) => hoursBetween(event.sentAt, event.replyAt as string))),
        optOuts: rows.filter((event) => event.optOut).length,
        trafficShare: null,
        winner: false,
        loser: false,
        guardrail: false,
      };
      return row;
    });
    const total = arm.reduce((sum, row) => sum + row.sends, 0);
    for (const row of arm) row.trafficShare = rate(row.sends, total);
    const control = arm.find((row) => row.variant === 'A');
    for (const row of arm) {
      if (!control || row.variant === 'A' || control.sends === 0 || row.optOuts === 0) continue;
      const variantRate = row.optOuts / row.sends;
      const controlRate = control.optOuts / control.sends;
      row.guardrail = variantRate > controlRate * 2;
    }
    const eligible = arm.filter((row) => row.enoughData && row.replyRate != null);
    if (eligible.length >= 2) {
      const ranked = [...eligible].sort((a, b) => (b.replyRate ?? 0) - (a.replyRate ?? 0));
      if ((ranked[0].replyRate ?? 0) > (ranked[1].replyRate ?? 0)) ranked[0].winner = true;
      const last = ranked[ranked.length - 1];
      if ((last.replyRate ?? 0) < (ranked[0].replyRate ?? 0)) last.loser = true;
    }
    stats.push(...arm);
  }
  return stats;
}

function dealSegments(deals: OutreachDeal[], labelOf: (deal: OutreachDeal) => string): SegmentStat[] {
  const labels = [...new Set(deals.map(labelOf))];
  return labels.map((label) => {
    const rows = deals.filter((deal) => labelOf(deal) === label);
    const replies = rows.filter((deal) => deal.replyWithin7Days).length;
    return { label, deals: rows.length, replies, replyRate: rate(replies, rows.length) };
  }).sort((a, b) => b.deals - a.deals);
}

function sendSegments(events: OutreachEvent[], labelOf: (event: OutreachEvent) => string, order: string[]): SegmentStat[] {
  return order.map((label) => {
    const rows = events.filter((event) => labelOf(event) === label);
    const replies = rows.filter((event) => event.replied).length;
    return { label, deals: rows.length, replies, replyRate: rate(replies, rows.length) };
  });
}

function isSentOutbound(event: OutreachEvent): boolean {
  return event.direction === 'outbound' && SENT.has(event.status);
}

function replyDay(deal: OutreachDeal): number {
  if (!deal.firstReplyAt) return -1;
  const hours = hoursBetween(deal.startedAt, deal.firstReplyAt);
  return Math.min(5, Math.max(0, Math.floor(hours / 24)));
}

function hourOf(event: OutreachEvent): number {
  const match = event.dealerLocalTime.match(/T(\d{2})/);
  return match ? Number(match[1]) : 0;
}

function hoursBetween(start: string, end: string): number {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / (60 * 60 * 1000));
}

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Wilson score interval at 95%. */
export function wilson(successes: number, total: number): { low: number; high: number } | null {
  if (total <= 0) return null;
  const z = 1.96;
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export function stopLabel(reason: StopReason): string {
  switch (reason) {
    case 'reply':
      return 'Dealer replied';
    case 'sold':
      return 'Sold';
    case 'opt_out':
      return 'Opt-out';
    case 'ended_no_response':
      return 'Ended, no response';
    case 'in_progress':
      return 'Still running';
    default:
      return reason;
  }
}

export function outcomeLabel(outcome: CallOutcome): string {
  return outcome.replace(/_/g, ' ');
}

export function channelLabel(channel: OutreachChannel): string {
  if (channel === 'sms') return 'Text';
  if (channel === 'voicemail') return 'Voicemail';
  return channel[0].toUpperCase() + channel.slice(1);
}

/**
 * Repository for querying outreach data from Supabase.
 * Replaces mock data with real database queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { OutreachDeal, OutreachEvent, OutreachRange } from '../admin/outreach/types';

export async function getOutreachDealsFromDb(
  supabase: SupabaseClient,
  range: OutreachRange,
): Promise<OutreachDeal[]> {
  const { data: events } = await supabase
    .from('outreach_events')
    .select('*')
    .gte('sent_at', `${range.from}T00:00:00.000Z`)
    .lte('sent_at', `${range.to}T23:59:59.999Z`)
    .order('sent_at', { ascending: true });

  if (!events || events.length === 0) {
    return [];
  }

  const dealMap = new Map<string, OutreachDeal>();

  for (const event of events) {
    let deal = dealMap.get(event.deal_id);

    if (!deal) {
      deal = {
        id: event.deal_id,
        shopperFirst: '',
        dealerId: event.dealer_id,
        dealerName: '',
        dealerType: event.dealer_type ?? 'franchise',
        brand: event.brand ?? '',
        region: event.region ?? '',
        dealerSize: event.dealer_size ?? 'mid',
        dealerTz: event.dealer_tz ?? 'America/New_York',
        mainLineTextable: false,
        vehicleId: event.vehicle_id,
        vehicle: '',
        vehicleShort: '',
        stock: '',
        listedPrice: 0,
        startedAt: event.sent_at,
        stop: 'in_progress',
        stopAt: null,
        otdReceived: false,
        firstReplyAt: null,
        firstReplyTouchpoint: null,
        replyWithin5Days: false,
        events: [],
      };
      dealMap.set(event.deal_id, deal);
    }

    const outreachEvent: OutreachEvent = {
      id: event.id,
      dealId: event.deal_id,
      dealerId: event.dealer_id,
      vehicleId: event.vehicle_id,
      touchpoint: event.touchpoint,
      variant: event.variant,
      channel: event.channel,
      direction: event.direction,
      toType: event.to_type ?? 'main_line',
      sentAt: event.sent_at,
      dealerLocalTime: event.dealer_local_time,
      dealerTz: event.dealer_tz,
      dayOfWeek: event.day_of_week,
      status: event.status,
      openedAt: event.opened_at,
      replied: event.replied,
      replyAt: event.reply_at,
      replyChannel: event.reply_channel,
      callOutcome: event.call_outcome,
      callDurationS: event.call_duration_s,
      capturedNumber: event.captured_number,
      optOut: event.opt_out,
      dealerType: event.dealer_type ?? 'franchise',
      brand: event.brand ?? '',
      region: event.region ?? '',
      dealerSize: event.dealer_size ?? 'mid',
      body: event.body ?? '',
      transcript: event.transcript,
      summary: event.summary,
    };

    deal.events.push(outreachEvent);

    if (event.replied && !deal.firstReplyAt) {
      deal.firstReplyAt = event.reply_at ?? event.sent_at;
      deal.firstReplyTouchpoint = event.touchpoint;
    }

    if (event.opt_out) {
      deal.stop = 'opt_out';
      deal.stopAt = event.sent_at;
    }

    if (event.call_outcome === 'sold') {
      deal.stop = 'sold';
      deal.stopAt = event.sent_at;
    }

    if (event.direction === 'inbound' && /\$\d/.test(event.body ?? '')) {
      deal.otdReceived = true;
    }
  }

  for (const deal of dealMap.values()) {
    if (deal.firstReplyAt) {
      const replyMs = Date.parse(deal.firstReplyAt);
      const startMs = Date.parse(deal.startedAt);
      deal.replyWithin5Days = replyMs - startMs <= 5 * 24 * 60 * 60 * 1000;
      if (deal.stop === 'in_progress') {
        deal.stop = 'reply';
        deal.stopAt = deal.firstReplyAt;
      }
    }

    if (deal.events.some((e) => e.touchpoint === 'D5-E4' && e.direction === 'outbound') && deal.stop === 'in_progress') {
      deal.stop = 'ended_no_response';
      deal.stopAt = deal.events.at(-1)?.sentAt ?? null;
    }
  }

  return Array.from(dealMap.values());
}

export async function getLatestDigest(
  supabase: SupabaseClient,
): Promise<{
  runId: string;
  working: string[];
  notWorking: string[];
  bottlenecks: string[];
  objections: string[];
  proposedLessons: Array<{ lesson: string; confidence: number }>;
  nextSteps: string[];
  generatedAt: string;
} | null> {
  const { data } = await supabase
    .from('brain_runs')
    .select('id, output, started_at')
    .eq('job', 'daily_digest')
    .eq('status', 'ok')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!data || !data.output) return null;

  const output = data.output as {
    working?: string[];
    notWorking?: string[];
    bottlenecks?: string[];
    objections?: string[];
    proposedLessons?: Array<{ lesson: string; confidence: number }>;
    nextSteps?: string[];
  };

  return {
    runId: data.id,
    working: output.working ?? [],
    notWorking: output.notWorking ?? [],
    bottlenecks: output.bottlenecks ?? [],
    objections: output.objections ?? [],
    proposedLessons: output.proposedLessons ?? [],
    nextSteps: output.nextSteps ?? [],
    generatedAt: data.started_at,
  };
}

export async function hasOutreachEventsTable(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from('outreach_events').select('id').limit(1);
  return !error || error.code !== 'PGRST116';
}

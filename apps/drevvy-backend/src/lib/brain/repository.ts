/**
 * Repository for brain tables: brain_vendor_events, vendor_incidents, brain_runs, brain_lessons.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type BrainVendorEvent = {
  id?: string;
  vendor: 'telnyx' | 'elevenlabs';
  vendor_event_id: string;
  event_type: string;
  channel: 'call' | 'sms' | 'email' | 'voicemail' | null;
  direction: 'outbound' | 'inbound' | null;
  deal_id: string | null;
  dealer_id: string | null;
  touchpoint: string | null;
  variant: string | null;
  status: string | null;
  error_code: string | null;
  error_detail: string | null;
  duration_s: number | null;
  transcript: string | null;
  summary: string | null;
  occurred_at: string;
  received_at?: string;
  signature_verified: boolean;
  payload: unknown;
  from_address?: string | null;
  to_address?: string | null;
  body?: string | null;
  recording_path?: string | null;
  recording_status?: string | null;
  is_test?: boolean;
  conversation_type?: 'ai_to_ai_test' | null;
  structured?: unknown;
  call_control_id?: string | null;
  conversation_id?: string | null;
  conversation_identity_id?: string | null;
};

export type VendorIncident = {
  id?: string;
  vendor: 'telnyx' | 'elevenlabs' | 'openai' | 'supabase' | 'vercel' | 'railway';
  external_id: string;
  title: string;
  status: string | null;
  impact: string | null;
  components: string[] | null;
  url: string | null;
  started_at: string | null;
  resolved_at: string | null;
  last_polled_at?: string;
  raw: unknown;
};

export type BrainRun = {
  id?: string;
  job: 'health_check' | 'daily_digest' | 'reply_decision' | 'eval';
  model: string;
  prompt_version: string;
  trigger_ref: string | null;
  status: 'running' | 'ok' | 'error' | 'blocked_by_guardrail';
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  tool_calls: unknown[];
  output: unknown;
  guardrail_hits: string[] | null;
  error: string | null;
  started_at?: string;
  finished_at: string | null;
};

export type BrainLesson = {
  id?: string;
  lesson: string;
  scope: Record<string, unknown>;
  evidence: Record<string, unknown> | null;
  confidence: number | null;
  status: 'proposed' | 'approved' | 'rejected' | 'retired';
  source_run_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at?: string;
};

export async function insertBrainVendorEvent(
  supabase: SupabaseClient,
  event: BrainVendorEvent,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('brain_vendor_events')
    .upsert(event, { onConflict: 'vendor,vendor_event_id,event_type' })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('brain_vendor_events')
        .select('id')
        .eq('vendor', event.vendor)
        .eq('vendor_event_id', event.vendor_event_id)
        .eq('event_type', event.event_type)
        .single();
      if (existing) return { id: existing.id };
    }
    return { error: error.message };
  }
  return { id: data.id };
}

export async function upsertVendorIncident(
  supabase: SupabaseClient,
  incident: VendorIncident,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('vendor_incidents')
    .upsert(incident, { onConflict: 'vendor,external_id' })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function markResolvedIncidents(
  supabase: SupabaseClient,
  vendor: VendorIncident['vendor'],
  activeExternalIds: string[],
): Promise<number> {
  const { data } = await supabase
    .from('vendor_incidents')
    .update({ resolved_at: new Date().toISOString(), last_polled_at: new Date().toISOString() })
    .eq('vendor', vendor)
    .is('resolved_at', null)
    .not('external_id', 'in', `(${activeExternalIds.map((id) => `'${id}'`).join(',')})`)
    .select('id');

  return data?.length ?? 0;
}

export async function insertBrainRun(
  supabase: SupabaseClient,
  run: Omit<BrainRun, 'id'>,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('brain_runs')
    .insert(run)
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function updateBrainRun(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<BrainRun>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('brain_runs')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function insertBrainLesson(
  supabase: SupabaseClient,
  lesson: Omit<BrainLesson, 'id'>,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('brain_lessons')
    .insert(lesson)
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function getApprovedLessons(
  supabase: SupabaseClient,
  scope?: { brand?: string; region?: string; dealer_type?: string; touchpoint?: string },
): Promise<BrainLesson[]> {
  let query = supabase
    .from('brain_lessons')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (scope?.brand) {
    query = query.or(`scope->brand.is.null,scope->brand.eq.${scope.brand}`);
  }
  if (scope?.region) {
    query = query.or(`scope->region.is.null,scope->region.eq.${scope.region}`);
  }

  const { data } = await query;
  return (data ?? []) as BrainLesson[];
}

export async function getRecentFailedEvents(
  supabase: SupabaseClient,
  options: { vendor?: string; since?: string; channel?: string; limit?: number; includeTest?: boolean },
): Promise<BrainVendorEvent[]> {
  let query = supabase
    .from('brain_vendor_events')
    .select('*')
    .not('error_code', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (!options.includeTest) query = query.eq('is_test', false);

  if (options.vendor) query = query.eq('vendor', options.vendor);
  if (options.since) query = query.gte('occurred_at', options.since);
  if (options.channel) query = query.eq('channel', options.channel);

  const { data } = await query;
  return (data ?? []) as BrainVendorEvent[];
}

export async function getOpenIncidents(
  supabase: SupabaseClient,
  vendor?: string,
): Promise<VendorIncident[]> {
  let query = supabase
    .from('vendor_incidents')
    .select('*')
    .is('resolved_at', null)
    .order('started_at', { ascending: false });

  if (vendor) query = query.eq('vendor', vendor);

  const { data } = await query;
  return (data ?? []) as VendorIncident[];
}

export async function getEventTranscript(
  supabase: SupabaseClient,
  identifier: { dealId?: string; eventId?: string },
): Promise<{ transcript: string | null; summary: string | null } | null> {
  if (identifier.eventId) {
    const { data } = await supabase
      .from('brain_vendor_events')
      .select('transcript, summary')
      .eq('id', identifier.eventId)
      .single();
    return data;
  }
  if (identifier.dealId) {
    const { data } = await supabase
      .from('brain_vendor_events')
      .select('transcript, summary')
      .eq('deal_id', identifier.dealId)
      .not('transcript', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .single();
    return data;
  }
  return null;
}

export async function getEventStats(
  supabase: SupabaseClient,
  options: { since: string; until?: string; includeTest?: boolean },
): Promise<{
  total: number;
  byVendor: Record<string, number>;
  byChannel: Record<string, number>;
  failures: number;
  unmatched: number;
}> {
  let query = supabase
    .from('brain_vendor_events')
    .select('vendor, channel, error_code, deal_id')
    .gte('occurred_at', options.since);

  if (!options.includeTest) query = query.eq('is_test', false);
  if (options.until) query = query.lte('occurred_at', options.until);

  const { data } = await query;
  const events = data ?? [];

  const byVendor: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  let failures = 0;
  let unmatched = 0;

  for (const event of events) {
    byVendor[event.vendor] = (byVendor[event.vendor] ?? 0) + 1;
    if (event.channel) {
      byChannel[event.channel] = (byChannel[event.channel] ?? 0) + 1;
    }
    if (event.error_code) failures++;
    if (!event.deal_id) unmatched++;
  }

  return { total: events.length, byVendor, byChannel, failures, unmatched };
}

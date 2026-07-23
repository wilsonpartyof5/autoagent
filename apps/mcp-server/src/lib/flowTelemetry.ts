import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env.js';

type FlowEvent = {
  flowId: string;
  eventName: string;
  source: 'mcp-server' | 'widget' | 'dashboard' | 'system';
  provider?: string;
  requestId?: string;
  toolName?: string;
  dealerId?: string;
  vehicleId?: string;
  vin?: string;
  status?: string;
  errorCode?: string;
  durationMs?: number;
  resultCount?: number;
  searchLocation?: string;
  payload?: Record<string, unknown>;
};

function client() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceRoleKey) return null;
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function recordFlowEvent(event: FlowEvent): Promise<void> {
  try {
    const supabase = client();
    if (!supabase) return;
    const now = new Date().toISOString();
    const { error: sessionError } = await supabase.from('app_sessions').upsert(
      {
        id: event.flowId,
        provider: event.provider ?? null,
        last_activity_at: now,
        search_location: event.searchLocation ?? null,
        result_count: event.resultCount ?? null,
        lead_id:
          typeof event.payload?.leadId === 'string'
            ? event.payload.leadId
            : undefined,
      },
      { onConflict: 'id' },
    );
    if (sessionError) throw sessionError;
    const { error } = await supabase.from('app_events').insert({
      flow_id: event.flowId,
      event_name: event.eventName,
      source: event.source,
      provider: event.provider ?? null,
      request_id: event.requestId ?? null,
      tool_name: event.toolName ?? null,
      dealer_id: event.dealerId ?? null,
      vehicle_id: event.vehicleId ?? null,
      vin: event.vin ?? null,
      status: event.status ?? null,
      error_code: event.errorCode ?? null,
      duration_ms: event.durationMs ?? null,
      result_count: event.resultCount ?? null,
      payload: event.payload ?? {},
      occurred_at: now,
    });
    if (error) throw error;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'flow_telemetry_failed',
        flowId: event.flowId,
        eventName: event.eventName,
        errorCode: 'FLOW_EVENT_INSERT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
  }
}

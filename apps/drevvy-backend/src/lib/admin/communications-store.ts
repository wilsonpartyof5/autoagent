import { createAdminClient } from '@/lib/supabase/admin';

import { collapseCallRecords, communicationFromRow, filterCommunications, type CommunicationRecord } from './communications';
import type { TrafficFilter } from './outreach/types';

const COLUMNS = 'id, event_type, channel, direction, from_address, to_address, body, transcript, summary, occurred_at, deal_id, dealer_id, touchpoint, status, duration_s, recording_path, is_test, conversation_type, structured, call_control_id';

export async function loadStoredCommunications(traffic: TrafficFilter): Promise<{
  rows: CommunicationRecord[];
  configured: boolean;
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], configured: false };
  }
  try {
    const admin = createAdminClient();
    let query = admin.from('brain_vendor_events').select(COLUMNS).order('occurred_at', { ascending: false }).limit(300);
    if (traffic === 'live') query = query.eq('is_test', false);
    if (traffic === 'test') query = query.eq('is_test', true);
    const { data, error } = await query;
    if (error || !data) return { rows: [], configured: true };
    const rows = data
      .map((row) => communicationFromRow(row as Record<string, unknown>))
      .filter((row): row is CommunicationRecord => row != null);
    return { rows: collapseCallRecords(filterCommunications(rows, traffic)), configured: true };
  } catch {
    return { rows: [], configured: true };
  }
}

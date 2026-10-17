import { createAdminClient } from '@/lib/supabase/admin';

import {
  assembleLiveMonitor,
  demoMonitorRows,
  parseMonitorFilters,
  presentMonitor,
  type LiveMonitorSources,
  type MonitorFilters,
  type OutreachMonitorView,
} from './outreach-monitor';

const READ_LIMIT = 2000;

const TABLES = [
  { field: 'widgetChatAttempts', table: 'widget_chat_attempts' },
  { field: 'outreachEvents', table: 'outreach_events' },
  { field: 'outreachMessages', table: 'shopper_outreach_messages' },
] as const;

type MonitorEnv = { NEXT_PUBLIC_SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export function liveMonitorConfigured(env: MonitorEnv | NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isMissingRelation(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find the table');
}

/**
 * Reads widget_chat_attempts and the outreach tables when they exist.
 * This module only selects. It does not insert rows or apply migrations.
 * Empty or missing tables return null buckets so the page can use demo data.
 */
export async function readLiveMonitorSources(): Promise<LiveMonitorSources> {
  if (!liveMonitorConfigured()) {
    return { widgetChatAttempts: null, outreachEvents: null, outreachMessages: null, failed: false };
  }

  try {
    const admin = createAdminClient();
    const reads = await Promise.all(TABLES.map(async (source) => {
      const { data, error } = await admin.from(source.table).select('*').limit(READ_LIMIT);
      if (error) {
        return { field: source.field, rows: null as Record<string, unknown>[] | null, failed: !isMissingRelation(error) };
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      return { field: source.field, rows, failed: rows.length >= READ_LIMIT };
    }));

    const sources: LiveMonitorSources = {
      widgetChatAttempts: null,
      outreachEvents: null,
      outreachMessages: null,
      failed: reads.some((read) => read.failed),
    };
    for (const read of reads) sources[read.field] = read.rows;
    return sources;
  } catch {
    return { widgetChatAttempts: null, outreachEvents: null, outreachMessages: null, failed: true };
  }
}

export async function loadOutreachMonitor(
  filters: MonitorFilters = parseMonitorFilters({}),
  read: () => Promise<LiveMonitorSources> = readLiveMonitorSources,
): Promise<OutreachMonitorView> {
  const sources = await read();
  const live = assembleLiveMonitor(sources);
  if (!live) return presentMonitor(demoMonitorRows(), 'demo', false, filters);
  return presentMonitor(live.rows, 'live', live.partial, filters);
}

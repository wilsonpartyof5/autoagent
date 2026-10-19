import type { SupabaseClient } from '@supabase/supabase-js';

import { DIRECTORY_STATUSES, type DealerDirectoryRow, type DealerDirectoryWrite, type DirectoryStatus, type DirectoryStore } from './types';

export function createSupabaseDirectoryStore(client: SupabaseClient): DirectoryStore {
  return {
    async findBySiteUrl(siteUrl) {
      const { data, error } = await client
        .from('dealer_directory')
        .select('*')
        .eq('site_url', siteUrl)
        .maybeSingle();
      if (error) throw new Error(`dealer_directory lookup failed: ${error.message}`);
      return data ? mapDirectoryRow(data) : null;
    },
    async list() {
      const pageSize = 1000;
      const rows: DealerDirectoryRow[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await client
          .from('dealer_directory')
          .select('*')
          .order('site_url', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error(`dealer_directory list failed: ${error.message}`);
        const batch = data ?? [];
        for (const item of batch) rows.push(mapDirectoryRow(item));
        if (batch.length < pageSize) break;
      }
      return rows;
    },
    async markCallEmailOnly(siteUrl) {
      const { data, error } = await client
        .from('dealer_directory')
        .update({ call_email_only: true })
        .eq('site_url', siteUrl)
        .select('id');
      if (error) throw new Error(`dealer_directory call/email update failed: ${error.message}`);
      if (Array.isArray(data) && data.length > 0) return;
      const { error: insertError } = await client.from('dealer_directory').insert({
        site_url: siteUrl,
        call_email_only: true,
        status: 'needs_review',
        phones: [],
        emails: [],
        source_urls: [],
      });
      if (!insertError) return;
      if (!/duplicate|unique/i.test(insertError.message)) {
        throw new Error(`dealer_directory call/email insert failed: ${insertError.message}`);
      }
      const retry = await client.from('dealer_directory').update({ call_email_only: true }).eq('site_url', siteUrl);
      if (retry.error) throw new Error(`dealer_directory call/email update failed: ${retry.error.message}`);
    },
    async upsert(row) {
      const { data, error } = await client
        .from('dealer_directory')
        .upsert(row, { onConflict: 'site_url' })
        .select('*')
        .single();
      if (error) throw new Error(`dealer_directory upsert failed: ${error.message}`);
      return mapDirectoryRow(data);
    },
  };
}

function mapDirectoryRow(data: unknown): DealerDirectoryRow {
  const row = asRecord(data);
  const status = row.status;
  if (typeof status !== 'string' || !DIRECTORY_STATUSES.includes(status as DirectoryStatus)) {
    throw new Error('dealer_directory row has an unexpected status.');
  }
  return {
    id: requiredString(row.id, 'id'),
    site_url: requiredString(row.site_url, 'site_url'),
    name: nullableString(row.name),
    phones: stringArray(row.phones),
    emails: stringArray(row.emails),
    widget_vendor: nullableString(row.widget_vendor),
    widget_playbook: nullableString(row.widget_playbook),
    source_urls: stringArray(row.source_urls),
    confidence: nullableNumber(row.confidence),
    last_checked_at: nullableString(row.last_checked_at),
    status: status as DirectoryStatus,
    call_email_only: row.call_email_only === true,
    created_at: requiredString(row.created_at, 'created_at'),
    updated_at: requiredString(row.updated_at, 'updated_at'),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('dealer_directory row was empty.');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`dealer_directory row is missing ${field}.`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export type { DealerDirectoryWrite };

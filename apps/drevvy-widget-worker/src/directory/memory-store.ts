import { randomUUID } from 'node:crypto';

import type { DealerDirectoryRow, DealerDirectoryWrite, DirectoryStore } from './types';

export class MemoryDirectoryStore implements DirectoryStore {
  readonly rows = new Map<string, DealerDirectoryRow>();
  readonly writes: DealerDirectoryWrite[] = [];

  async findBySiteUrl(siteUrl: string): Promise<DealerDirectoryRow | null> {
    return this.rows.get(siteUrl) ?? null;
  }

  async list(): Promise<DealerDirectoryRow[]> {
    return [...this.rows.values()].sort((a, b) => a.site_url.localeCompare(b.site_url));
  }

  async upsert(row: DealerDirectoryWrite): Promise<DealerDirectoryRow> {
    this.writes.push(row);
    const existing = this.rows.get(row.site_url);
    const now = new Date().toISOString();
    const saved: DealerDirectoryRow = {
      ...row,
      id: existing?.id ?? randomUUID(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
      call_email_only: existing?.call_email_only ?? false,
    };
    this.rows.set(row.site_url, saved);
    return saved;
  }

  async markCallEmailOnly(siteUrl: string): Promise<void> {
    const existing = this.rows.get(siteUrl);
    const now = new Date().toISOString();
    if (existing) {
      existing.call_email_only = true;
      existing.updated_at = now;
      return;
    }
    this.rows.set(siteUrl, {
      id: randomUUID(),
      site_url: siteUrl,
      name: null,
      phones: [],
      emails: [],
      widget_vendor: null,
      widget_playbook: null,
      source_urls: [],
      confidence: null,
      last_checked_at: null,
      status: 'needs_review',
      call_email_only: true,
      created_at: now,
      updated_at: now,
    });
  }
}

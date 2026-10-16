import { randomUUID } from 'node:crypto';

import type { DealerDirectoryRow, DealerDirectoryWrite, DirectoryStore } from './types';

export class MemoryDirectoryStore implements DirectoryStore {
  readonly rows = new Map<string, DealerDirectoryRow>();
  readonly writes: DealerDirectoryWrite[] = [];

  async findBySiteUrl(siteUrl: string): Promise<DealerDirectoryRow | null> {
    return this.rows.get(siteUrl) ?? null;
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
    };
    this.rows.set(row.site_url, saved);
    return saved;
  }
}

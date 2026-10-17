export const DIRECTORY_STATUSES = [
  'active',
  'stale',
  'unreachable',
  'no_widget',
  'needs_review',
] as const;

export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

export type DealerDirectoryWrite = {
  site_url: string;
  name: string | null;
  phones: string[];
  emails: string[];
  widget_vendor: string | null;
  widget_playbook: string | null;
  source_urls: string[];
  confidence: number | null;
  last_checked_at: string | null;
  status: DirectoryStatus;
};

export type DealerDirectoryRow = DealerDirectoryWrite & {
  id: string;
  created_at: string;
  updated_at: string;
};

export const DIRECTORY_WRITE_KEYS = [
  'site_url',
  'name',
  'phones',
  'emails',
  'widget_vendor',
  'widget_playbook',
  'source_urls',
  'confidence',
  'last_checked_at',
  'status',
] as const;

export interface DirectoryStore {
  findBySiteUrl(siteUrl: string): Promise<DealerDirectoryRow | null>;
  upsert(row: DealerDirectoryWrite): Promise<DealerDirectoryRow>;
}

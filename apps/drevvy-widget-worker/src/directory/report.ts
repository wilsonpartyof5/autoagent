import { DIRECTORY_STATUSES, type DealerDirectoryRow, type DirectoryStatus } from './types';

export type DirectoryReport = {
  dealers: number;
  byStatus: Record<DirectoryStatus, number>;
  byVendor: Array<{ vendor: string; count: number }>;
  phone: number;
  email: number;
  both: number;
  neither: number;
};

export function summarizeDirectory(rows: DealerDirectoryRow[]): DirectoryReport {
  const byStatus = Object.fromEntries(DIRECTORY_STATUSES.map((status) => [status, 0])) as Record<DirectoryStatus, number>;
  const vendors = new Map<string, number>();
  let phone = 0;
  let email = 0;
  let both = 0;
  let neither = 0;
  for (const row of rows) {
    byStatus[row.status] += 1;
    const vendor = row.widget_vendor?.trim() ? row.widget_vendor.trim() : '(none)';
    vendors.set(vendor, (vendors.get(vendor) ?? 0) + 1);
    const hasPhone = row.phones.length > 0;
    const hasEmail = row.emails.length > 0;
    if (hasPhone) phone += 1;
    if (hasEmail) email += 1;
    if (hasPhone && hasEmail) both += 1;
    if (!hasPhone && !hasEmail) neither += 1;
  }
  const byVendor = [...vendors.entries()]
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((left, right) => right.count - left.count || left.vendor.localeCompare(right.vendor));
  return { dealers: rows.length, byStatus, byVendor, phone, email, both, neither };
}

export function formatDirectoryReport(report: DirectoryReport): string {
  const statusLines = DIRECTORY_STATUSES.map((status) => `${status.padEnd(16)}${report.byStatus[status]}`);
  const vendors = report.byVendor.length > 0 ? report.byVendor : [{ vendor: '(none)', count: 0 }];
  const vendorLines = vendors.map((entry) => `${entry.vendor.padEnd(16)}${entry.count}`);
  const total = report.dealers;
  const cover = (label: string, count: number) => `${label.padEnd(8)}${count}/${total} (${percent(count, total)})`;
  return [
    'Directory report',
    `dealers  ${total}`,
    '',
    'By status',
    ...statusLines,
    '',
    'By vendor',
    ...vendorLines,
    '',
    'Coverage',
    cover('phone', report.phone),
    cover('email', report.email),
    cover('both', report.both),
    cover('neither', report.neither),
  ].join('\n');
}

function percent(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

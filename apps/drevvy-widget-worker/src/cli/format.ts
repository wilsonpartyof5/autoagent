export type ResultRow = {
  url: string;
  vendor: string;
  status: string;
  price: string | null;
  dryRun: string;
  channel?: string;
  playbook?: string;
  reason?: string;
  fallback?: string;
};

export function formatResultsTable(rows: ResultRow[]): string {
  const headers = ['url', 'vendor', 'status', 'price', 'dry_run', 'channel', 'playbook', 'reason', 'fallback'];
  const body = rows.map((row) => [
    truncate(row.url, 64),
    row.vendor || '-',
    row.status || '-',
    row.price ?? '-',
    row.dryRun || '-',
    row.channel || '-',
    row.playbook || '-',
    truncate(row.reason || '-', 72),
    row.fallback || '-',
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((line) => line[index]?.length ?? 0), 1),
  );
  const render = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join('  ');
  if (body.length === 0) return `${render(headers)}\n(no rows)`;
  return [render(headers), ...body.map(render)].join('\n');
}

export function parseUrlList(text: string): Array<{ url: string; stockNumber: string | null }> {
  const targets: Array<{ url: string; stockNumber: string | null }> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [url, stock] = trimmed.split(/\s+/, 2);
    if (!url) continue;
    targets.push({ url, stockNumber: stock ?? null });
  }
  return targets;
}

export function formatHealthSummary(rows: Array<{ vendor: string; status: string; reason?: string }>): string {
  const vendors = tally(rows.map((row) => (row.vendor && row.vendor !== '-' ? row.vendor : 'unknown')));
  const reasons = tally(rows.map((row) => (row.reason && row.reason !== '-' ? row.reason : row.status)));
  return `Health summary\nvendors: ${vendors}\nreasons: ${reasons}`;
}

function tally(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  if (counts.size === 0) return '(none)';
  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, count]) => `${key}=${count}`)
    .join(', ');
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

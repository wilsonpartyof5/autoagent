export type ResultRow = {
  url: string;
  vendor: string;
  status: string;
  price: string | null;
  dryRun: string;
  channel?: string;
};

export function formatResultsTable(rows: ResultRow[]): string {
  const headers = ['url', 'vendor', 'status', 'price', 'dry_run', 'channel'];
  const body = rows.map((row) => [
    truncate(row.url, 64),
    row.vendor || '-',
    row.status || '-',
    row.price ?? '-',
    row.dryRun || '-',
    row.channel || '-',
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

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

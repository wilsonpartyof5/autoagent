import type { ChatClient } from '../ai/types';
import { isDueForRefresh } from '../directory/refresh';
import type { DealerDirectoryRow, DirectoryStore } from '../directory/types';
import { researchVehiclePage, type PageFetcher, type ResearchResult } from '../research/job';
import { siteUrlFromVehiclePage } from '../research/urls';
import type { LaunchArea } from './areas';
import { createRateLimiter } from './limit';
import type { DealerHint } from './marketcheck';

export type DealerSource = (area: LaunchArea, pace: () => Promise<void>) => Promise<DealerHint[]>;

export type SeedAction = 'researched' | 'skipped' | 'blocked' | 'error';

export type SeedRow = {
  siteUrl: string;
  status: string;
  vendor: string | null;
  phones: number;
  emails: number;
  action: SeedAction;
};

export type SeedSummary = {
  areas: number;
  dealers: number;
  researched: number;
  skipped: number;
  blocked: number;
  errors: number;
  areaErrors: number;
  rows: SeedRow[];
};

export async function seedDirectory(input: {
  areas: LaunchArea[];
  listDealers: DealerSource;
  fetchPage: PageFetcher;
  ai: ChatClient;
  store: DirectoryStore;
  now?: Date;
  force?: boolean;
  minIntervalMs: number;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
  log?: (line: string) => void;
}): Promise<SeedSummary> {
  const now = input.now ?? new Date();
  const log = input.log ?? (() => undefined);
  const pace = createRateLimiter(input.minIntervalMs, input.sleep, input.clock);
  const summary: SeedSummary = {
    areas: input.areas.length,
    dealers: 0,
    researched: 0,
    skipped: 0,
    blocked: 0,
    errors: 0,
    areaErrors: 0,
    rows: [],
  };
  const bySite = new Map<string, DealerHint>();

  for (const area of input.areas) {
    try {
      const hints = await input.listDealers(area, pace);
      for (const hint of hints) {
        let siteUrl: string;
        try {
          siteUrl = siteUrlFromVehiclePage(hint.siteUrl);
        } catch (error) {
          summary.errors += 1;
          const message = error instanceof Error ? error.message : 'invalid URL';
          log(`[seed] skipped an unusable dealer website (${message})`);
          continue;
        }
        if (bySite.has(siteUrl)) continue;
        bySite.set(siteUrl, {
          name: hint.name ?? null,
          siteUrl,
          phone: hint.phone ?? null,
          email: hint.email ?? null,
        });
      }
    } catch (error) {
      summary.areaErrors += 1;
      const message = error instanceof Error ? error.message : 'MarketCheck request failed.';
      log(`[seed] ZIP ${area.zip} ${message}`);
    }
  }

  const dealers = [...bySite.values()].sort((left, right) => left.siteUrl.localeCompare(right.siteUrl));
  summary.dealers = dealers.length;

  for (const hint of dealers) {
    const home = `${hint.siteUrl}/`;
    try {
      const existing = await input.store.findBySiteUrl(hint.siteUrl);
      if (existing && !input.force && !isDueForRefresh(existing.last_checked_at, now)) {
        summary.skipped += 1;
        summary.rows.push(seedRow(hint.siteUrl, existing, 'skipped'));
        log(`[seed] ${hint.siteUrl} skipped`);
        continue;
      }
      await pace();
      const result = await researchVehiclePage({
        vehiclePageUrl: home,
        hints: {
          dealerName: hint.name,
          phone: hint.phone,
          email: hint.email,
        },
        fetchPage: input.fetchPage,
        ai: input.ai,
        store: input.store,
        now,
        force: input.force,
      });
      const action = actionFor(result);
      if (action === 'blocked') summary.blocked += 1;
      else if (action === 'error') summary.errors += 1;
      else if (action === 'skipped') summary.skipped += 1;
      else summary.researched += 1;
      summary.rows.push({
        siteUrl: hint.siteUrl,
        status: result.row?.status ?? 'error',
        vendor: result.row?.widget_vendor ?? null,
        phones: result.row?.phones.length ?? 0,
        emails: result.row?.emails.length ?? 0,
        action,
      });
      if (result.error) log(`[seed] ${hint.siteUrl} ${result.error}`);
      else log(`[seed] ${hint.siteUrl} ${result.row?.status ?? 'error'} ${action}`);
    } catch (error) {
      summary.errors += 1;
      const message = error instanceof Error ? error.message : 'Research failed.';
      summary.rows.push({
        siteUrl: hint.siteUrl,
        status: 'error',
        vendor: null,
        phones: 0,
        emails: 0,
        action: 'error',
      });
      log(`[seed] ${hint.siteUrl} ${message}`);
    }
  }

  return summary;
}

export function formatSeedSummary(summary: SeedSummary): string {
  const counts = [
    `areas        ${summary.areas}`,
    `dealers      ${summary.dealers}`,
    `researched   ${summary.researched}`,
    `skipped      ${summary.skipped}`,
    `blocked      ${summary.blocked}`,
    `errors       ${summary.errors}`,
    `area_errors  ${summary.areaErrors}`,
  ].join('\n');
  const header = ['site', 'status', 'vendor', 'phones', 'emails', 'action'];
  const body = summary.rows.map((row) => [
    row.siteUrl,
    row.status,
    row.vendor ?? '-',
    String(row.phones),
    String(row.emails),
    row.action,
  ]);
  const widths = header.map((label, index) => Math.max(label.length, ...body.map((line) => line[index]?.length ?? 0), 1));
  const render = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join('  ');
  const table = body.length === 0 ? `${render(header)}\n(no rows)` : [render(header), ...body.map(render)].join('\n');
  return `Seed\n${counts}\n\n${table}`;
}

function actionFor(result: ResearchResult): SeedAction {
  if (result.skipped) return 'skipped';
  if (!result.row) return 'error';
  if (result.row.status === 'blocked') return 'blocked';
  return 'researched';
}

function seedRow(siteUrl: string, row: DealerDirectoryRow, action: SeedAction): SeedRow {
  return {
    siteUrl,
    status: row.status,
    vendor: row.widget_vendor,
    phones: row.phones.length,
    emails: row.emails.length,
    action,
  };
}

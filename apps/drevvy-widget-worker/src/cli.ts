#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createChatClient } from './ai/client';
import type { ChatClient } from './ai/types';
import { runWidgetChat, type WidgetChatConfig } from './chat/agent';
import { runLeadForm } from './forms/lead';
import { mapWithConcurrency } from './scan/pool';
import { runDay0 } from './run/day0';
import { runScan } from './scan/run';
import { MemoryAttemptStore } from './chat/memory-store';
import { createSupabaseAttemptStore } from './chat/supabase-store';
import type { AttemptResult, AttemptStore, ChatPage, Day0Fallback, WidgetChatAttemptWrite } from './chat/types';
import { assertChatConfig, assertOutreachConfig, assertResearchConfig, assertSeedConfig, assertSupabaseConfig, chatSettings, loadConfig, type AppConfig } from './config';
import { MemoryDirectoryStore } from './directory/memory-store';
import { formatDirectoryReport, summarizeDirectory } from './directory/report';
import { createSupabaseDirectoryStore } from './directory/supabase-store';
import type { DirectoryStore } from './directory/types';
import { formatResultsTable, parseUrlList, type ResultRow } from './cli/format';
import { parseHintsFile } from './research/hints';
import { createHttpFetcher, researchVehiclePage, type PageFetcher } from './research/job';
import { siteUrlFromVehiclePage } from './research/urls';
import { parseLaunchAreas, type LaunchArea } from './seed/areas';
import { listMarketCheckDealers } from './seed/marketcheck';
import { formatSeedSummary, seedDirectory, type DealerSource } from './seed/run';
import { createSupabase } from './supabase';

const HELP = `Drevvy dealer research, lead-form, and chat-widget worker.

Usage:
  drevvy-widget-worker research <url-or-file> [--force] [--hints file.json]
  drevvy-widget-worker seed <zip-file-or-zip> [--radius miles] [--force]
  drevvy-widget-worker report
  drevvy-widget-worker scan <url-or-file> [--concurrency N]
  drevvy-widget-worker lead <url-or-file> [--stock STOCK]
  drevvy-widget-worker chat <url-or-file> [--stock STOCK]
  drevvy-widget-worker run <url-or-file> [--force] [--hints file.json]

A file has one vehicle page URL per line. An optional second column is the stock number.
Lines starting with # are ignored.

seed reads launch-area ZIPs and a radius in miles, asks MarketCheck for dealer names
and websites, then researches each dealer site. MarketCheck is a hint. Listing fields
are dropped and nothing from MarketCheck is stored. Phone, email, and widget vendor
come from the dealer's own site, with the page URL and a confidence. A bot wall is
stored as blocked and is not fetched again until the row is older than 30 days.
Rows younger than 30 days are skipped, so a rerun resumes. Requests are spaced by
SEED_MIN_INTERVAL_MS. Seed never sends a message.
A ZIP file has one ZIP per line, or ZIP and radius in miles. --radius fills lines
that omit a radius.
report counts the directory by vendor and by status, and how many rows have a phone
or an email.

run researches the dealer, scans the widget, then sends the chosen day-0 channels.
A ready widget gets the widget chat and the lead form (first name and the Drevvy number).
Any other widget status gets the lead form only. A bot wall is not retried and is
marked for email, text, and call.
scan opens each page, waits for late widgets, and prints vendor, playbook, and status.
It scans up to 3 sites at once (--concurrency) and gives each site 25 seconds.
It does not type into a composer or submit a form. One failed URL does not stop the rest.
DRY_RUN defaults to true. A dry run opens the page and logs the message or form fields
it would send. Live sending requires DRY_RUN=false and WIDGET_CHAT_ALLOWLIST.
`;

const COMMANDS = new Set(['research', 'scan', 'lead', 'chat', 'run', 'seed', 'report']);

type Command = 'research' | 'scan' | 'lead' | 'chat' | 'run' | 'seed' | 'report';

type Target = { url: string; stockNumber: string | null };

export type CliDeps = {
  config: AppConfig;
  directory: DirectoryStore;
  attempts: AttemptStore;
  fetchPage: PageFetcher;
  ai: ChatClient;
  openPage: () => Promise<{ page: ChatPage; close: () => Promise<void> }>;
  readFile: (filePath: string) => string;
  exists: (filePath: string) => boolean;
  writeLine?: (line: string) => void;
  listDealers?: DealerSource;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

type CliResult = { exitCode: number; stdout: string; stderr: string };

export async function execute(argv: string[], deps: CliDeps): Promise<CliResult> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { exitCode: 0, stdout: HELP, stderr: '' };
  }
  const command = argv[0];
  if (!command || !COMMANDS.has(command)) {
    return { exitCode: 1, stdout: '', stderr: `Unknown command: ${command}\n${HELP}` };
  }
  if (command === 'report') return executeReport(deps);
  if (command === 'seed') return executeSeed(argv.slice(1), deps);
  try {
    const flags = parseFlags(argv.slice(1));
    const targets = collectTargets(flags.positionals, flags.stock, deps);
    if (targets.length === 0) {
      return { exitCode: 1, stdout: '', stderr: 'No vehicle page URLs were provided.\n' };
    }
    const hints = flags.hintsPath ? parseHintsFile(deps.readFile(flags.hintsPath)) : {};
    const logs: string[] = [];
    const sections: string[] = [];
    const log = (line: string) => {
      if (deps.writeLine) deps.writeLine(line);
      else logs.push(line);
    };

    if (command === 'research' || command === 'run') {
      const rows: ResultRow[] = [];
      for (const target of targets) {
        const result = await researchVehiclePage({
          vehiclePageUrl: target.url,
          hints: hints[target.url],
          fetchPage: deps.fetchPage,
          ai: deps.ai,
          store: deps.directory,
          force: flags.force,
        });
        rows.push({
          url: target.url,
          vendor: result.row?.widget_vendor ?? '-',
          status: result.error ? 'error' : result.skipped ? 'skipped' : (result.row?.status ?? 'error'),
          price: null,
          dryRun: '-',
          channel: '-',
        });
        if (result.error) log(`[research] ${target.url} ${result.error}`);
      }
      sections.push(`Research\n${formatResultsTable(rows)}`);
    }

    if (command === 'scan') {
      const rows: ResultRow[] = new Array(targets.length);
      const concurrency = flags.concurrency ?? deps.config.scanConcurrency;
      await mapWithConcurrency(targets, concurrency, async (target, index) => {
        const row = await scanTarget(target, deps, log);
        rows[index] = row;
        log(`[scan] ${row.url} ${row.vendor} ${row.status} ${row.reason ?? '-'}`);
      });
      sections.push(`Scan\n${formatResultsTable(rows)}`);
    }

    if (command === 'run') {
      const runs = await runDay0({
        targets,
        openPage: deps.openPage,
        ai: deps.ai,
        attempts: deps.attempts,
        directory: deps.directory,
        config: deps.config,
        log,
      });
      const dayRows: ResultRow[] = runs.map((run) => ({
        url: run.url,
        vendor: run.scan?.widgetVendor ?? '-',
        status: run.scan?.status ?? 'error',
        price: null,
        dryRun: String(deps.config.dryRun),
        channel: run.plan.channels.join(',') || '-',
        playbook: run.scan?.playbook ?? 'generic',
        reason: run.plan.reason,
        fallback: run.plan.fallback ?? '-',
      }));
      sections.push(`Day 0\n${formatResultsTable(dayRows)}`);
      const leadRows = runs.flatMap((run) => (run.lead ? [resultRow(run.url, run.lead, run.plan.reason, run.plan.fallback)] : []));
      const chatRows = runs.flatMap((run) => (run.chat ? [resultRow(run.url, run.chat, run.plan.reason, run.plan.fallback)] : []));
      if (leadRows.length > 0) sections.push(`Lead form\n${formatResultsTable(leadRows)}`);
      if (chatRows.length > 0) sections.push(`Widget chat\n${formatResultsTable(chatRows)}`);
    }

    if (command === 'lead') {
      const settings = chatSettings(deps.config);
      const rows: ResultRow[] = [];
      for (const target of targets) {
        const opened = await deps.openPage();
        try {
          const result = await runLeadForm({
            vehiclePageUrl: target.url,
            stockNumber: target.stockNumber,
            page: opened.page,
            config: settings,
            store: deps.attempts,
            log,
          });
          rows.push({
            url: target.url,
            vendor: result.widgetVendor ?? '-',
            status: result.status,
            price: result.price,
            dryRun: String(result.dryRun),
            channel: result.channel,
          });
          if (result.error) log(`[lead] ${target.url} ${result.error}`);
        } finally {
          await opened.close();
        }
      }
      sections.push(`Lead form\n${formatResultsTable(rows)}`);
    }

    if (command === 'chat') {
      const settings = chatSettings(deps.config);
      const rows: ResultRow[] = [];
      for (const target of targets) {
        const opened = await deps.openPage();
        try {
          const result = await runWidgetChat({
            vehiclePageUrl: target.url,
            stockNumber: target.stockNumber,
            page: opened.page,
            ai: deps.ai,
            config: settings,
            store: deps.attempts,
            log,
          });
          rows.push({
            url: target.url,
            vendor: result.widgetVendor ?? '-',
            status: result.status,
            price: result.price,
            dryRun: String(result.dryRun),
            channel: result.channel,
          });
          if (result.error) log(`[chat] ${target.url} ${result.error}`);
        } finally {
          await opened.close();
        }
      }
      sections.push(`Widget chat\n${formatResultsTable(rows)}`);
    }

    const stdout = [...logs, ...sections].filter((part) => part.length > 0).join('\n') + '\n';
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}

export function buildDeps(config: AppConfig, overrides: Partial<CliDeps> = {}): CliDeps {
  const supabase =
    config.supabaseUrl && config.supabaseServiceRoleKey
      ? createSupabase(config.supabaseUrl, config.supabaseServiceRoleKey)
      : null;
  const ai: ChatClient =
    config.aiApiKey && config.aiModel
      ? createChatClient({ apiKey: config.aiApiKey, baseUrl: config.aiBaseUrl, model: config.aiModel })
      : {
          async complete() {
            throw new Error('AI_API_KEY and AI_MODEL are required.');
          },
        };
  return {
    config,
    directory: supabase ? createSupabaseDirectoryStore(supabase) : new MemoryDirectoryStore(),
    attempts: supabase ? createSupabaseAttemptStore(supabase) : new MemoryAttemptStore(),
    fetchPage: createHttpFetcher(config.fetchTimeoutMs),
    ai,
    openPage: async () => {
      const { launchChatBrowser } = await import('./chat/playwright-page');
      const launched = await launchChatBrowser(config.scanSettleMs);
      return { page: launched.chatPage, close: launched.close };
    },
    readFile: (filePath) => readFileSync(filePath, 'utf8'),
    exists: (filePath) => existsSync(filePath),
    writeLine: (line) => {
      process.stdout.write(`${line}\n`);
    },
    listDealers: (area, pace) => {
      if (!config.marketcheckApiKey) {
        throw new Error('MARKETCHECK_API_KEY is required to seed the directory.');
      }
      return listMarketCheckDealers({
        area,
        apiKey: config.marketcheckApiKey,
        baseUrl: config.marketcheckBaseUrl,
        timeoutMs: config.fetchTimeoutMs,
        pace,
      });
    },
    ...overrides,
  };
}

async function executeReport(deps: CliDeps): Promise<CliResult> {
  try {
    const rows = await deps.directory.list();
    return { exitCode: 0, stdout: `${formatDirectoryReport(summarizeDirectory(rows))}\n`, stderr: '' };
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: `${error instanceof Error ? error.message : String(error)}\n` };
  }
}

async function executeSeed(argv: string[], deps: CliDeps): Promise<CliResult> {
  try {
    const flags = parseSeedFlags(argv);
    const areas = collectAreas(flags.positionals, flags.radius, deps);
    if (!deps.listDealers) {
      return { exitCode: 1, stdout: '', stderr: 'MARKETCHECK_API_KEY is required to seed the directory.\n' };
    }
    const lines: string[] = [];
    const log = (line: string) => {
      if (deps.writeLine) deps.writeLine(line);
      else lines.push(line);
    };
    const summary = await seedDirectory({
      areas,
      listDealers: deps.listDealers,
      fetchPage: deps.fetchPage,
      ai: deps.ai,
      store: deps.directory,
      now: deps.now?.() ?? new Date(),
      force: flags.force,
      minIntervalMs: deps.config.seedIntervalMs,
      sleep: deps.sleep,
      log,
    });
    const stdout = [...lines, formatSeedSummary(summary)].filter((part) => part.length > 0).join('\n') + '\n';
    const stderr = summary.areaErrors > 0 ? `MarketCheck failed for ${summary.areaErrors} launch area(s).\n` : '';
    return { exitCode: summary.areaErrors > 0 ? 1 : 0, stdout, stderr };
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: `${error instanceof Error ? error.message : String(error)}\n` };
  }
}

function resultRow(url: string, result: AttemptResult, reason: string, fallback: Day0Fallback | null): ResultRow {
  return {
    url,
    vendor: result.widgetVendor ?? '-',
    status: result.status,
    price: result.price,
    dryRun: String(result.dryRun),
    channel: result.channel,
    reason,
    fallback: fallback ?? '-',
  };
}

async function scanTarget(
  target: Target,
  deps: CliDeps,
  log: (line: string) => void,
): Promise<ResultRow> {
  const started = new Date().toISOString();
  try {
    const opened = await deps.openPage();
    try {
      const result = await runScan({
        vehiclePageUrl: target.url,
        page: opened.page,
        ai: deps.ai,
        attempts: deps.attempts,
        directory: deps.directory,
        timeoutMs: deps.config.scanTimeoutMs,
        log,
      });
      return {
        url: target.url,
        vendor: result.widgetVendor ?? '-',
        status: result.status,
        price: null,
        dryRun: String(result.dryRun),
        channel: result.channel,
        playbook: result.playbook,
        reason: result.reason,
      };
    } finally {
      await opened.close().catch(() => undefined);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    let site: string | null = null;
    try {
      site = siteUrlFromVehiclePage(target.url);
    } catch {
      site = null;
    }
    const attempt: WidgetChatAttemptWrite = {
      vehicle_page_url: target.url,
      dealer_site_url: site,
      stock_number: target.stockNumber,
      widget_vendor: null,
      status: 'error',
      price: null,
      dry_run: true,
      transcript: [{ role: 'system', text: reason, at: started }],
      stop_reason: reason,
      error: reason,
      started_at: started,
      finished_at: new Date().toISOString(),
      channel: 'widget',
      first_reply_channel: null,
    };
    try {
      await deps.attempts.insert(attempt);
    } catch {
      // The row is still printed. A store failure must not stop the remaining URLs.
    }
    return {
      url: target.url,
      vendor: '-',
      status: 'error',
      price: null,
      dryRun: 'true',
      channel: 'widget',
      playbook: 'generic',
      reason,
    };
  }
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const config = loadConfig();
    const command = argv[0] as Command | undefined;
    if (command === 'research' || command === 'run') assertResearchConfig(config);
    if (command === 'seed') assertSeedConfig(config);
    if (command === 'scan' || command === 'report') assertSupabaseConfig(config);
    if (command === 'lead' || command === 'run') assertOutreachConfig(config, config.dryRun);
    if (command === 'chat' || command === 'run') assertChatConfig(config, config.dryRun);
    const result = await execute(argv, buildDeps(config));
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return result.exitCode;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function parseFlags(argv: string[]): {
  force: boolean;
  hintsPath: string | null;
  stock: string | null;
  concurrency: number | null;
  positionals: string[];
} {
  let force = false;
  let hintsPath: string | null = null;
  let stock: string | null = null;
  let concurrency: number | null = null;
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') force = true;
    else if (arg === '--hints') {
      hintsPath = requiredValue(argv, index, '--hints');
      index += 1;
    } else if (arg === '--stock') {
      stock = requiredValue(argv, index, '--stock');
      index += 1;
    } else if (arg === '--concurrency') {
      const raw = requiredValue(argv, index, '--concurrency');
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) throw new Error('--concurrency must be a positive integer.');
      concurrency = parsed;
      index += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length === 0) throw new Error('Provide a vehicle page URL or a file of URLs.');
  return { force, hintsPath, stock, concurrency, positionals };
}

function parseSeedFlags(argv: string[]): { force: boolean; radius: number | null; positionals: string[] } {
  let force = false;
  let radius: number | null = null;
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') force = true;
    else if (arg === '--radius') {
      const raw = requiredValue(argv, index, '--radius');
      if (!/^\d+$/.test(raw)) throw new Error('--radius must be a whole number of miles.');
      const parsed = Number(raw);
      if (parsed < 1 || parsed > 500) throw new Error('--radius must be from 1 to 500 miles.');
      radius = parsed;
      index += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length === 0) throw new Error('Provide a ZIP, a list of ZIPs, or a file of ZIPs.');
  return { force, radius, positionals };
}

function collectAreas(
  positionals: string[],
  radius: number | null,
  deps: Pick<CliDeps, 'readFile' | 'exists'>,
): LaunchArea[] {
  if (positionals.length === 1) {
    const input = positionals[0];
    if (!input) throw new Error('Provide a ZIP, a list of ZIPs, or a file of ZIPs.');
    if (deps.exists(input) && !/^\d{5}$/.test(input)) {
      const areas = parseLaunchAreas(deps.readFile(input), radius);
      if (areas.length === 0) throw new Error('No launch areas were provided.');
      return areas;
    }
    if (!/^\d{5}$/.test(input)) throw new Error(`Not a ZIP or file: ${input}`);
  }
  const areas = parseLaunchAreas(positionals.join('\n'), radius);
  if (areas.length === 0) throw new Error('No launch areas were provided.');
  return areas;
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
  return value;
}

function collectTargets(
  positionals: string[],
  stock: string | null,
  deps: Pick<CliDeps, 'readFile' | 'exists'>,
): Target[] {
  if (positionals.length === 1) {
    const input = positionals[0];
    const targets = deps.exists(input)
      ? parseUrlList(deps.readFile(input))
      : /^https?:\/\//i.test(input)
        ? [{ url: input, stockNumber: null }]
        : null;
    if (!targets) throw new Error(`Not a URL or file: ${input}`);
    if (stock) {
      if (targets.length !== 1) throw new Error('--stock applies to a single URL.');
      targets[0] = { ...targets[0], stockNumber: stock };
    }
    return targets;
  }
  if (stock) throw new Error('--stock applies to a single URL.');
  return positionals.map((url) => ({ url, stockNumber: null }));
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry.endsWith(`${path.sep}cli.ts`) || entry.endsWith(`${path.sep}cli.js`)) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}

export type { WidgetChatConfig };

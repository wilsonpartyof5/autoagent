#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createChatClient } from './ai/client';
import type { ChatClient } from './ai/types';
import { runWidgetChat, type WidgetChatConfig } from './chat/agent';
import { MemoryAttemptStore } from './chat/memory-store';
import { createSupabaseAttemptStore } from './chat/supabase-store';
import type { AttemptStore, ChatPage } from './chat/types';
import { assertChatConfig, assertResearchConfig, chatSettings, loadConfig, type AppConfig } from './config';
import { MemoryDirectoryStore } from './directory/memory-store';
import { createSupabaseDirectoryStore } from './directory/supabase-store';
import type { DirectoryStore } from './directory/types';
import { formatResultsTable, parseUrlList, type ResultRow } from './cli/format';
import { parseHintsFile } from './research/hints';
import { createHttpFetcher, researchVehiclePage, type PageFetcher } from './research/job';
import { createSupabase } from './supabase';

const HELP = `Drevvy dealer research and chat-widget worker.

Usage:
  drevvy-widget-worker research <url-or-file> [--force] [--hints file.json]
  drevvy-widget-worker chat <url-or-file> [--stock STOCK]
  drevvy-widget-worker run <url-or-file> [--force] [--hints file.json]

A file has one vehicle page URL per line. An optional second column is the stock number.
Lines starting with # are ignored.

DRY_RUN defaults to true: the chat command opens the page, names the widget, and logs
the message it would send. It does not type into the widget.
Live sending requires DRY_RUN=false and WIDGET_CHAT_ALLOWLIST.
`;

type Command = 'research' | 'chat' | 'run';

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
};

type CliResult = { exitCode: number; stdout: string; stderr: string };

export async function execute(argv: string[], deps: CliDeps): Promise<CliResult> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { exitCode: 0, stdout: HELP, stderr: '' };
  }
  const command = argv[0];
  if (command !== 'research' && command !== 'chat' && command !== 'run') {
    return { exitCode: 1, stdout: '', stderr: `Unknown command: ${command}\n${HELP}` };
  }
  try {
    const flags = parseFlags(argv.slice(1));
    const targets = collectTargets(flags.positionals, flags.stock, deps);
    if (targets.length === 0) {
      return { exitCode: 1, stdout: '', stderr: 'No vehicle page URLs were provided.\n' };
    }
    const hints = flags.hintsPath ? parseHintsFile(deps.readFile(flags.hintsPath)) : {};
    const logs: string[] = [];
    const sections: string[] = [];

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
        });
        if (result.error) logs.push(`[research] ${target.url} ${result.error}`);
      }
      sections.push(`Research\n${formatResultsTable(rows)}`);
    }

    if (command === 'chat' || command === 'run') {
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
            log: (line) => logs.push(line),
          });
          rows.push({
            url: target.url,
            vendor: result.widgetVendor ?? '-',
            status: result.status,
            price: result.price,
            dryRun: String(result.dryRun),
          });
          if (result.error) logs.push(`[chat] ${target.url} ${result.error}`);
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
      const launched = await launchChatBrowser();
      return { page: launched.chatPage, close: launched.close };
    },
    readFile: (filePath) => readFileSync(filePath, 'utf8'),
    exists: (filePath) => existsSync(filePath),
    ...overrides,
  };
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const config = loadConfig();
    const command = argv[0] as Command | undefined;
    if (command === 'research' || command === 'run') assertResearchConfig(config);
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
  positionals: string[];
} {
  let force = false;
  let hintsPath: string | null = null;
  let stock: string | null = null;
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
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length === 0) throw new Error('Provide a vehicle page URL or a file of URLs.');
  return { force, hintsPath, stock, positionals };
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

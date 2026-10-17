import type { ChatClient } from '../ai/types';
import { runWidgetChat } from '../chat/agent';
import type { AttemptResult, AttemptStore, ChatPage } from '../chat/types';
import { chatSettings, type AppConfig } from '../config';
import type { ConversationContact } from '../forms/identity';
import type { DirectoryStore } from '../directory/types';
import { runLeadForm } from '../forms/lead';
import { runScan, type ScanResult } from '../scan/run';
import { selectDay0Channels, selectionRecord, type Day0Plan } from './channels';

export type Day0Target = { url: string; stockNumber: string | null };

export type Day0Run = {
  url: string;
  plan: Day0Plan;
  scan: ScanResult | null;
  lead: AttemptResult | null;
  chat: AttemptResult | null;
};

type OpenedPage = { page: ChatPage; close: () => Promise<void> };

export async function runDay0(input: {
  targets: Day0Target[];
  openPage: () => Promise<OpenedPage>;
  ai: ChatClient;
  attempts: AttemptStore;
  directory: DirectoryStore;
  config: AppConfig;
  contact?: ConversationContact | null;
  log?: (line: string) => void;
}): Promise<Day0Run[]> {
  const log = input.log ?? (() => undefined);
  const settings = chatSettings(input.config, input.contact ?? null);
  const runs: Day0Run[] = [];
  for (const target of input.targets) {
    try {
      runs.push(await runOne(target, input, settings, log));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`[day0] ${target.url} ${message}`);
      const plan = selectDay0Channels('error');
      runs.push({ url: target.url, plan, scan: null, lead: null, chat: null });
    }
  }
  return runs;
}

async function runOne(
  target: Day0Target,
  input: {
    openPage: () => Promise<OpenedPage>;
    ai: ChatClient;
    attempts: AttemptStore;
    directory: DirectoryStore;
    config: AppConfig;
  },
  settings: ReturnType<typeof chatSettings>,
  log: (line: string) => void,
): Promise<Day0Run> {
  let scan: ScanResult | null = null;
  try {
    scan = await withPage(input.openPage, (page) =>
      runScan({
        vehiclePageUrl: target.url,
        page,
        ai: input.ai,
        attempts: input.attempts,
        directory: input.directory,
        timeoutMs: input.config.scanTimeoutMs,
        log,
      }),
    );
  } catch (error) {
    log(`[day0] ${target.url} scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const plan = selectDay0Channels(scan?.status ?? 'error');
  const selection = selectionRecord(plan);
  if (scan?.id) {
    try {
      await input.attempts.annotate(scan.id, selection);
    } catch (error) {
      log(`[day0] ${target.url} could not record the channel choice: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(`[day0] ${target.url} ${plan.channels.join(',') || 'none'} ${plan.reason}`);

  if (plan.fallback || plan.channels.length === 0) {
    return { url: target.url, plan, scan, lead: null, chat: null };
  }

  let chat: AttemptResult | null = null;
  if (plan.channels.includes('widget')) {
    try {
      chat = await withPage(input.openPage, (page) =>
        runWidgetChat({
          vehiclePageUrl: target.url,
          stockNumber: target.stockNumber,
          page,
          ai: input.ai,
          config: settings,
          store: input.attempts,
          log,
          selection,
        }),
      );
    } catch (error) {
      log(`[day0] ${target.url} chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let lead: AttemptResult | null = null;
  if (plan.channels.includes('lead_form')) {
    const contactMode = plan.channels.includes('widget') ? 'name_and_phone' : 'full';
    try {
      lead = await withPage(input.openPage, (page) =>
        runLeadForm({
          vehiclePageUrl: target.url,
          stockNumber: target.stockNumber,
          page,
          config: { ...settings, contactMode },
          store: input.attempts,
          log,
          selection,
        }),
      );
    } catch (error) {
      log(`[day0] ${target.url} lead failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { url: target.url, plan, scan, lead, chat };
}

async function withPage<T>(openPage: () => Promise<OpenedPage>, work: (page: ChatPage) => Promise<T>): Promise<T> {
  const opened = await openPage();
  try {
    return await work(opened.page);
  } finally {
    await opened.close().catch(() => undefined);
  }
}

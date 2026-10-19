import type { ChatClient } from '../ai/types';
import { runWidgetChat } from '../chat/agent';
import type { AttemptResult, AttemptStore, ChatPage } from '../chat/types';
import { chatSettings, type AppConfig } from '../config';
import type { ConversationContact } from '../forms/identity';
import type { DirectoryStore } from '../directory/types';
import { runLeadForm } from '../forms/lead';
import { checkVehicleTrim, type TrimCheck } from '../forms/trim';
import { runScan, type ScanResult } from '../scan/run';
import { siteUrlFromVehiclePage } from '../research/urls';
import { applyCallEmailOnly, applyContactPhoneFallback, selectDay0Channels, selectionRecord, type Day0Plan } from './channels';

export type Day0Target = {
  url: string;
  stockNumber: string | null;
  dealId?: string | null;
  vin?: string | null;
  marketcheckTrim?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
};

export type Day0Run = {
  url: string;
  plan: Day0Plan;
  scan: ScanResult | null;
  lead: AttemptResult | null;
  chat: AttemptResult | null;
  trim: TrimCheck | null;
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
  decodeVin?: (vin: string) => Promise<string | null>;
  onTrimFlag?: (input: { dealId: string | null; check: TrimCheck }) => Promise<void>;
  onContactPhone?: (input: { dealId: string; phone: string }) => Promise<void>;
  log?: (line: string) => void;
  saveScreenshot?: (bytes: Buffer, vehiclePageUrl: string) => Promise<string | null>;
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
      runs.push({ url: target.url, plan, scan: null, lead: null, chat: null, trim: null });
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
    saveScreenshot?: (bytes: Buffer, vehiclePageUrl: string) => Promise<string | null>;
    decodeVin?: (vin: string) => Promise<string | null>;
    onTrimFlag?: (flag: { dealId: string | null; check: TrimCheck }) => Promise<void>;
    onContactPhone?: (note: { dealId: string; phone: string }) => Promise<void>;
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

  const trim = await reviewTrim(target, scan, input.decodeVin);
  if (trim.mismatch) {
    log(`[trim] ${target.url} flagged. ${trim.shopperMessage ?? ''}`);
    if (input.onTrimFlag) {
      try {
        await input.onTrimFlag({ dealId: target.dealId ?? null, check: trim });
      } catch (error) {
        log(`[trim] ${target.url} could not flag the deal: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  const vehicle = {
    verifiedTrim: trim.verifiedTrim,
    vehicleYear: target.year ?? null,
    vehicleMake: target.make ?? null,
    vehicleModel: target.model ?? null,
    vehicleVin: target.vin ?? null,
  };
  let plan = selectDay0Channels(scan?.status ?? 'error');
  plan = applyCallEmailOnly(plan, await callEmailOnly(target.url, input.directory, log));
  plan = applyContactPhoneFallback(plan, {
    phoneRequired: scan?.phoneRequired === true,
    contactPhone: settings.drevvyContactPhone,
  });
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
    return { url: target.url, plan, scan, lead: null, chat: null, trim };
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
          config: { ...settings, ...vehicle },
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
    const contactMode = plan.contactMode ?? (plan.channels.includes('widget') ? 'name_and_phone' : 'full');
    try {
      lead = await withPage(input.openPage, (page) =>
        runLeadForm({
          vehiclePageUrl: target.url,
          stockNumber: target.stockNumber,
          page,
          config: { ...settings, ...vehicle, contactMode, verifiedTrim: trim.verifiedTrim },
          store: input.attempts,
          directory: input.directory,
          log,
          selection,
          saveScreenshot: input.saveScreenshot
            ? (bytes) => input.saveScreenshot?.(bytes, target.url) ?? Promise.resolve(null)
            : undefined,
        }),
      );
    } catch (error) {
      log(`[day0] ${target.url} lead failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const phone = settings.drevvyContactPhone;
  const disclosed = Boolean(phone && target.dealId && [chat, lead].some((result) => disclosedPhone(result)));
  if (disclosed && phone && target.dealId && input.onContactPhone) {
    try {
      await input.onContactPhone({ dealId: target.dealId, phone });
    } catch (error) {
      log(`[phone] ${target.url} could not record the contact number: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { url: target.url, plan, scan, lead, chat, trim };
}

async function reviewTrim(
  target: Day0Target,
  scan: ScanResult | null,
  decodeVin?: (vin: string) => Promise<string | null>,
): Promise<TrimCheck> {
  const vin = target.vin?.trim() || null;
  let vinDecode: string | null = null;
  if (vin && decodeVin) {
    try {
      vinDecode = await decodeVin(vin);
    } catch {
      vinDecode = null;
    }
  }
  return checkVehicleTrim({
    marketcheck: target.marketcheckTrim ?? null,
    vdp: scan?.vdpTrim ?? null,
    vinDecode,
  });
}

function disclosedPhone(result: AttemptResult | null): boolean {
  return result?.transcript.some((entry) => entry.text.startsWith('phone:')) === true;
}

async function callEmailOnly(vehiclePageUrl: string, directory: DirectoryStore, log: (line: string) => void): Promise<boolean> {
  try {
    const site = siteUrlFromVehiclePage(vehiclePageUrl);
    const dealer = await directory.findBySiteUrl(site);
    return dealer?.call_email_only === true;
  } catch (error) {
    log(`[day0] ${vehiclePageUrl} could not read call/email only: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function withPage<T>(openPage: () => Promise<OpenedPage>, work: (page: ChatPage) => Promise<T>): Promise<T> {
  const opened = await openPage();
  try {
    return await work(opened.page);
  } finally {
    await opened.close().catch(() => undefined);
  }
}

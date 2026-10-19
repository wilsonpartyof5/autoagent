import type { ChatClient } from '../ai/types';
import type { AttemptResult, AttemptStatus, AttemptStore, ChatPage } from '../chat/types';
import type { DealerDirectoryRow, DealerDirectoryWrite, DirectoryStatus, DirectoryStore } from '../directory/types';
import { isTimeoutError } from '../widgets/timeout';
import { prepareInspection, type WidgetInspection } from '../widgets/inspect';
import { actionsFor, playbookForVendor, type WidgetPlaybook } from '../widgets/playbooks';
import { widgetRequiresPhone } from '../forms/phone';
import { extractVdpTrim } from '../forms/trim';
import { siteUrlFromVehiclePage } from '../research/urls';
import { WIDGET_VENDORS, type WidgetVendor } from '../widgets/vendors';

export type ScanResult = AttemptResult & {
  playbook: WidgetPlaybook;
  reason: string;
  phoneRequired: boolean;
  vdpTrim: string | null;
};

const DEFAULT_SCAN_TIMEOUT_MS = 25_000;

export async function runScan(input: {
  vehiclePageUrl: string;
  page: ChatPage;
  ai: ChatClient;
  attempts: AttemptStore;
  directory: DirectoryStore;
  timeoutMs?: number;
  now?: () => Date;
  log?: (line: string) => void;
}): Promise<ScanResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS;
  let pending: Promise<ScanResult> | null = null;
  const finishOnce = (details: Parameters<typeof finish>[1]): Promise<ScanResult> => {
    if (!pending) pending = finish(input, details);
    return pending;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ScanResult>((resolve) => {
    timer = setTimeout(() => {
      resolve(
        finishOnce({
          site: safeSite(input.vehiclePageUrl),
          vendor: null,
          playbook: 'generic',
          status: 'page_timeout',
          reason: `Scan timed out after ${timeoutMs}ms.`,
          started: (input.now ?? (() => new Date()))(),
          now: input.now ?? (() => new Date()),
          log: input.log ?? (() => undefined),
          saveDirectory: true,
          directoryStatus: 'needs_review',
        }),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([scanBody(input, finishOnce), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeSite(vehiclePageUrl: string): string | null {
  try {
    return siteUrlFromVehiclePage(vehiclePageUrl);
  } catch {
    return null;
  }
}

async function scanBody(
  input: {
    vehiclePageUrl: string;
    page: ChatPage;
    ai: ChatClient;
    attempts: AttemptStore;
    directory: DirectoryStore;
    now?: () => Date;
    log?: (line: string) => void;
  },
  finishOnce: (details: Parameters<typeof finish>[1]) => Promise<ScanResult>,
): Promise<ScanResult> {
  const now = input.now ?? (() => new Date());
  const log = input.log ?? (() => undefined);
  const started = now();
  let site: string | null = null;
  try {
    site = siteUrlFromVehiclePage(input.vehiclePageUrl);
  } catch (error) {
    return finishOnce({
      site,
      vendor: null,
      playbook: 'generic',
      status: 'error',
      reason: error instanceof Error ? error.message : 'Invalid vehicle page URL.',
      started,
      now,
      log,
      saveDirectory: false,
    });
  }

  if (await input.attempts.hasBlockedSite(site)) {
    log(`[scan] ${input.vehiclePageUrl} blocked (already recorded)`);
    return {
      id: null,
      vehiclePageUrl: input.vehiclePageUrl,
      dealerSiteUrl: site,
      stockNumber: null,
      widgetVendor: null,
      status: 'blocked',
      price: null,
      dryRun: true,
      transcript: [],
      stopReason: 'blocked',
      error: null,
      channel: 'widget',
      playbook: 'generic',
      reason: 'The site was already recorded as blocked.',
      phoneRequired: false,
      vdpTrim: null,
    };
  }

  try {
    await input.page.goto(input.vehiclePageUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not open the page.';
    const timedOut = isTimeoutError(error);
    return finishOnce({
      site,
      vendor: null,
      playbook: 'generic',
      status: timedOut ? 'page_timeout' : 'error',
      reason: timedOut ? 'The page timed out before it could be scanned.' : message,
      started,
      now,
      log,
      saveDirectory: true,
      directoryStatus: 'needs_review',
    });
  }

  try {
    const inspection = await prepareInspection(input.page, input.ai, log);
    if (inspection.launcherFound && !inspection.composerFound && !inspection.gateFound && !inspection.captcha) {
      const actions = actionsFor(inspection.vendor);
      await input.page.click(actions.launchSelectors);
      inspection.composerFound = await input.page.composerVisible(
        actions.composerSelectors,
        inspection.vendor ? actions.frameUrl : null,
      );
    }

    const outcome = classifyScan(inspection);
    const html = await input.page.content();
    log(`[scan] ${input.vehiclePageUrl} ${outcome.status}: ${outcome.reason}`);
    return finishOnce({
      site,
      vendor: inspection.vendor,
      playbook: inspection.playbook,
      status: outcome.status,
      reason: outcome.reason,
      started,
      now,
      log,
      saveDirectory: true,
      directoryStatus: directoryStatusFor(outcome.status, inspection.vendor),
      overlays: inspection.overlaysDismissed,
      phoneRequired: widgetRequiresPhone(html, inspection.vendor),
      vdpTrim: extractVdpTrim(html),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed.';
    const timedOut = isTimeoutError(error);
    log(`[scan] ${input.vehiclePageUrl} ${timedOut ? 'page_timeout' : 'error'}: ${message}`);
    return finishOnce({
      site,
      vendor: null,
      playbook: 'generic',
      status: timedOut ? 'page_timeout' : 'error',
      reason: message,
      started,
      now,
      log,
      saveDirectory: true,
      directoryStatus: 'needs_review',
    });
  }
}

function classifyScan(inspection: WidgetInspection): { status: AttemptStatus; reason: string } {
  if (inspection.blocked) {
    const signature = inspection.blockSignature ?? 'bot-wall';
    return { status: 'blocked', reason: `Blocked: ${signature}.` };
  }
  if (inspection.captcha) return { status: 'captcha', reason: 'Stopped: captcha.' };
  const present = inspection.launcherFound || inspection.gateFound;
  if (!present && !inspection.vendor) {
    return { status: 'no_widget', reason: 'No chat vendor or launcher appeared after the wait.' };
  }
  if (!present) {
    const via = inspection.source ?? 'the page';
    return {
      status: 'widget_offline',
      reason: `${inspection.vendor} was detected from ${via}, and no launcher appeared after the wait.`,
    };
  }
  if (!inspection.composerFound && !inspection.gateFound) {
    return { status: 'composer_not_found', reason: 'The launcher was on the page, and the message composer did not appear.' };
  }
  const vendor = inspection.vendor ?? 'an unknown widget';
  return { status: 'dry_run', reason: `${vendor} is ready with the ${inspection.playbook} playbook.` };
}

function directoryStatusFor(status: AttemptStatus, vendor: string | null): DirectoryStatus {
  if (status === 'page_timeout' || status === 'blocked' || status === 'error') return 'needs_review';
  if (vendor) return 'active';
  if (status === 'dry_run') return 'active';
  return 'no_widget';
}

async function finish(
  input: {
    vehiclePageUrl: string;
    attempts: AttemptStore;
    directory: DirectoryStore;
  },
  details: {
    site: string | null;
    vendor: string | null;
    playbook: WidgetPlaybook;
    status: AttemptStatus;
    reason: string;
    started: Date;
    now: () => Date;
    log: (line: string) => void;
    saveDirectory: boolean;
    directoryStatus?: DirectoryStatus;
    overlays?: string[];
    phoneRequired?: boolean;
    vdpTrim?: string | null;
  },
): Promise<ScanResult> {
  const playbook = playbookForVendor(knownVendor(details.vendor));
  if (details.saveDirectory && details.site) {
    const existing = await input.directory.findBySiteUrl(details.site);
    await input.directory.upsert(
      mergeFinding(existing, {
        siteUrl: details.site,
        pageUrl: input.vehiclePageUrl,
        vendor: details.vendor,
        playbook,
        status: details.directoryStatus ?? 'needs_review',
        checkedAt: details.now().toISOString(),
      }),
    );
  }
  const result: ScanResult = {
    id: null,
    vehiclePageUrl: input.vehiclePageUrl,
    dealerSiteUrl: details.site,
    stockNumber: null,
    widgetVendor: details.vendor,
    status: details.status,
    price: null,
    dryRun: true,
    transcript: [
      {
        role: 'system',
        text: details.reason,
        at: details.now().toISOString(),
        via: 'planned',
      },
    ],
    stopReason: details.reason,
    error: details.status === 'error' ? details.reason : null,
    channel: 'widget',
    playbook,
    reason: details.reason,
    phoneRequired: details.phoneRequired === true,
    vdpTrim: details.vdpTrim ?? null,
  };
  if (details.overlays && details.overlays.length > 0) {
    result.transcript.push({
      role: 'system',
      text: `Dismissed overlays: ${details.overlays.join(', ')}`,
      at: details.now().toISOString(),
    });
  }
  try {
    const saved = await input.attempts.insert({
      vehicle_page_url: input.vehiclePageUrl,
      dealer_site_url: details.site,
      stock_number: null,
      widget_vendor: details.vendor,
      status: details.status,
      price: null,
      dry_run: true,
      transcript: result.transcript,
      stop_reason: details.reason,
      error: result.error,
      started_at: details.started.toISOString(),
      finished_at: details.now().toISOString(),
      channel: 'widget',
      first_reply_channel: null,
    });
    result.id = saved.id;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Could not save the scan.';
    result.status = 'error';
  }
  return result;
}

function knownVendor(value: string | null): WidgetVendor | null {
  if (!value) return null;
  return WIDGET_VENDORS.find((vendor) => vendor === value) ?? null;
}

export function mergeFinding(
  existing: DealerDirectoryRow | null,
  input: {
    siteUrl: string;
    pageUrl: string;
    vendor: string | null;
    playbook: WidgetPlaybook;
    status: DirectoryStatus;
    checkedAt: string;
  },
): DealerDirectoryWrite {
  const sourceUrls = existing?.source_urls ?? [];
  return {
    site_url: input.siteUrl,
    name: existing?.name ?? null,
    phones: existing?.phones ?? [],
    emails: existing?.emails ?? [],
    widget_vendor: input.vendor,
    widget_playbook: input.playbook,
    source_urls: sourceUrls.includes(input.pageUrl) ? sourceUrls : [...sourceUrls, input.pageUrl],
    confidence: input.vendor ? Math.max(existing?.confidence ?? 0, 0.85) : (existing?.confidence ?? 0.2),
    last_checked_at: input.checkedAt,
    status: input.status,
  };
}

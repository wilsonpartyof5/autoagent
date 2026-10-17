import type { ChatClient } from '../ai/types';
import { parseExtraction } from '../ai/parse';
import { isDueForRefresh } from '../directory/refresh';
import type { DealerDirectoryRow, DealerDirectoryWrite, DirectoryStatus, DirectoryStore } from '../directory/types';
import { detectWidgetVendor, vendorMentioned } from '../widgets/detect';
import { playbookForVendor } from '../widgets/playbooks';
import { vendorFromModel } from '../widgets/vendors';
import { blockWallSignature } from '../forms/outreach';
import { buildPageExcerpt } from './excerpt';
import { hintLines, type MarketCheckContactHint } from './hints';
import { siteUrlFromVehiclePage } from './urls';
import { groundEmails, groundName, groundPhones, roundConfidence } from './validate';

export type FetchedPage = {
  url: string;
  status: number;
  html: string;
};

export type PageFetcher = (url: string) => Promise<FetchedPage>;

export type ResearchResult = {
  vehiclePageUrl: string;
  siteUrl: string | null;
  skipped: boolean;
  row: DealerDirectoryRow | null;
  error: string | null;
};

const RESEARCH_SYSTEM = `You extract dealership facts from dealer website text.
Return JSON only:
{
  "name": string | null,
  "phones": string[],
  "emails": string[],
  "widget_vendor": "gubagoo" | "activengage" | "carnow" | "podium" | "kenect" | "contactatonce" | "fullpath" | "impel" | "matador" | "smartpath" | "aiva" | null,
  "confidence": number
}
Rules:
- Phones and emails must appear in the page text or links. Drop anything that does not.
- Contact hints are unverified. Ignore a hint when the page does not show that same value.
- Do not invent a widget vendor. Use null when the page does not name one.
- confidence is from 0 to 1.
- Do not include listing prices, VINs, or any other MarketCheck payload.`;

export async function researchVehiclePage(input: {
  vehiclePageUrl: string;
  hints?: MarketCheckContactHint;
  fetchPage: PageFetcher;
  ai: ChatClient;
  store: DirectoryStore;
  now?: Date;
  force?: boolean;
}): Promise<ResearchResult> {
  const now = input.now ?? new Date();
  let siteUrl: string;
  try {
    siteUrl = siteUrlFromVehiclePage(input.vehiclePageUrl);
  } catch (error) {
    return {
      vehiclePageUrl: input.vehiclePageUrl,
      siteUrl: null,
      skipped: false,
      row: null,
      error: error instanceof Error ? error.message : 'Invalid vehicle page URL.',
    };
  }

  const existing = await input.store.findBySiteUrl(siteUrl);
  if (existing && !input.force && !isDueForRefresh(existing.last_checked_at, now)) {
    return { vehiclePageUrl: input.vehiclePageUrl, siteUrl, skipped: true, row: existing, error: null };
  }

  const pages = await fetchDealerPages(input.vehiclePageUrl, siteUrl, input.fetchPage);
  const usable = pages.filter((page) => page.status >= 200 && page.status < 400 && !blockWallSignature(page.html, page.status));
  const walls = pages.filter((page) => blockWallSignature(page.html, page.status) != null);
  if (usable.length === 0 && walls.length > 0) {
    const row = await input.store.upsert(
      blockedRecord(
        siteUrl,
        existing,
        walls.map((page) => page.url),
        now.toISOString(),
      ),
    );
    return { vehiclePageUrl: input.vehiclePageUrl, siteUrl, skipped: false, row, error: null };
  }
  if (usable.length === 0) {
    const row = await input.store.upsert(
      preserveExisting(siteUrl, existing, {
        name: null,
        phones: [],
        emails: [],
        widget_vendor: null,
        widget_playbook: null,
        source_urls: [],
        confidence: 0,
        last_checked_at: now.toISOString(),
        status: 'unreachable',
      }),
    );
    return { vehiclePageUrl: input.vehiclePageUrl, siteUrl, skipped: false, row, error: null };
  }

  const html = usable.map((page) => page.html).join('\n');
  const detected = detectWidgetVendor(html);
  let extractedName: string | null = null;
  let extractedPhones: string[] = [];
  let extractedEmails: string[] = [];
  let extractedVendor: string | null = null;
  let extractedConfidence: number | null = null;
  let aiError: string | null = null;

  try {
    const raw = await input.ai.complete({
      messages: [
        { role: 'system', content: RESEARCH_SYSTEM },
        {
          role: 'user',
          content: `${hintLines(input.hints)}\nDeterministic widget scan: ${detected ?? 'none'}\n\n${buildPageExcerpt(html)}`,
        },
      ],
    });
    const extracted = parseExtraction(raw);
    extractedName = extracted.name;
    extractedPhones = extracted.phones;
    extractedEmails = extracted.emails;
    extractedVendor = extracted.widgetVendor;
    extractedConfidence = extracted.confidence;
  } catch (error) {
    aiError = error instanceof Error ? error.message : 'AI extraction failed.';
  }

  const phones = groundPhones(extractedPhones, html);
  const emails = groundEmails(extractedEmails, html);
  const name = groundName(extractedName, html);
  const aiVendor = vendorFromModel(extractedVendor);
  const vendor = detected ?? (aiVendor && vendorMentioned(html, aiVendor) ? aiVendor : null);
  let confidence = extractedConfidence ?? (vendor ? 0.55 : 0.2);
  if (vendor) confidence = Math.max(confidence, 0.8);
  if (aiError) confidence = Math.min(confidence, vendor ? 0.6 : 0.2);

  const status = directoryStatus({ vendor, phones, emails, confidence, aiError });
  const row = await input.store.upsert({
    site_url: siteUrl,
    name,
    phones,
    emails,
    widget_vendor: vendor,
    widget_playbook: playbookForVendor(vendor),
    source_urls: usable.map((page) => page.url),
    confidence: roundConfidence(confidence),
    last_checked_at: now.toISOString(),
    status,
  });
  return { vehiclePageUrl: input.vehiclePageUrl, siteUrl, skipped: false, row, error: aiError };
}

export async function fetchDealerPages(
  vehiclePageUrl: string,
  siteUrl: string,
  fetchPage: PageFetcher,
): Promise<FetchedPage[]> {
  const urls = [vehiclePageUrl];
  const home = `${siteUrl}/`;
  if (new URL(vehiclePageUrl).pathname !== '/') urls.push(home);
  const pages: FetchedPage[] = [];
  for (const url of urls) {
    try {
      const page = await fetchPage(url);
      if (!page.html.trim()) continue;
      if (blockWallSignature(page.html, page.status) || (page.status >= 200 && page.status < 400)) {
        pages.push(page);
      }
    } catch {
      // Try the other URL. A total miss is recorded by the caller.
    }
  }
  return pages;
}

export const RESEARCH_USER_AGENT = 'Mozilla/5.0 (compatible; DrevvyDealerResearch/0.1; +https://drevvy.com)';

export function createHttpFetcher(timeoutMs: number): PageFetcher {
  return async (url) => {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': RESEARCH_USER_AGENT,
      },
    });
    const html = (await response.text()).slice(0, 1_500_000);
    return { url, status: response.status, html };
  };
}

function directoryStatus(input: {
  vendor: string | null;
  phones: string[];
  emails: string[];
  confidence: number;
  aiError: string | null;
}): DirectoryStatus {
  if (input.aiError && !input.vendor) return 'needs_review';
  if (!input.vendor && input.phones.length === 0 && input.emails.length === 0) return 'needs_review';
  if (!input.vendor) return 'no_widget';
  if (input.confidence < 0.5) return 'needs_review';
  return 'active';
}

function blockedRecord(
  siteUrl: string,
  existing: DealerDirectoryRow | null,
  sourceUrls: string[],
  checkedAt: string,
): DealerDirectoryWrite {
  if (!existing) {
    return {
      site_url: siteUrl,
      name: null,
      phones: [],
      emails: [],
      widget_vendor: null,
      widget_playbook: null,
      source_urls: sourceUrls,
      confidence: null,
      last_checked_at: checkedAt,
      status: 'blocked',
    };
  }
  const urls = [...existing.source_urls];
  for (const url of sourceUrls) {
    if (!urls.includes(url)) urls.push(url);
  }
  return {
    site_url: siteUrl,
    name: existing.name,
    phones: existing.phones,
    emails: existing.emails,
    widget_vendor: existing.widget_vendor,
    widget_playbook: existing.widget_playbook,
    source_urls: urls,
    confidence: existing.confidence,
    last_checked_at: checkedAt,
    status: 'blocked',
  };
}

function preserveExisting(
  siteUrl: string,
  existing: DealerDirectoryRow | null,
  fallback: Omit<DealerDirectoryWrite, 'site_url'>,
): DealerDirectoryWrite {
  if (!existing) return { site_url: siteUrl, ...fallback };
  return {
    site_url: siteUrl,
    name: existing.name,
    phones: existing.phones,
    emails: existing.emails,
    widget_vendor: existing.widget_vendor,
    widget_playbook: existing.widget_playbook,
    source_urls: existing.source_urls,
    confidence: existing.confidence,
    last_checked_at: fallback.last_checked_at,
    status: 'unreachable',
  };
}

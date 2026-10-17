import { preferConversationContact, type ConversationContact } from './forms/identity';
import { assertLeadLastName, DEFAULT_LEAD_LAST_NAME, normalizeZip } from './forms/outreach';
import { normalizeEmail, normalizePhone } from './research/validate';

export const MAX_TURNS_CAP = 6;

export type AppConfig = {
  aiBaseUrl: string;
  aiApiKey: string | null;
  aiModel: string | null;
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  dryRun: boolean;
  allowlist: string[];
  drevvyTextNumber: string | null;
  drevvyEmail: string | null;
  shopperFirst: string | null;
  leadLastName: string;
  leadZip: string | null;
  fetchTimeoutMs: number;
  maxTurns: number;
  scanSettleMs: number;
  scanConcurrency: number;
  scanTimeoutMs: number;
  marketcheckApiKey: string | null;
  marketcheckBaseUrl: string;
  seedIntervalMs: number;
  testMode: boolean;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const textNumber = blankToNull(env.DREVVY_TEXT_NUMBER);
  const email = blankToNull(env.DREVVY_EMAIL);
  return {
    aiBaseUrl: blankToNull(env.AI_BASE_URL) ?? 'https://api.openai.com/v1',
    aiApiKey: blankToNull(env.AI_API_KEY),
    aiModel: blankToNull(env.AI_MODEL),
    supabaseUrl: blankToNull(env.SUPABASE_URL),
    supabaseServiceRoleKey: blankToNull(env.SUPABASE_SERVICE_ROLE_KEY),
    dryRun: env.DRY_RUN !== 'false',
    allowlist: parseAllowlist(env.WIDGET_CHAT_ALLOWLIST),
    drevvyTextNumber: textNumber,
    drevvyEmail: email ? normalizeEmail(email) : null,
    shopperFirst: blankToNull(env.SHOPPER_FIRST_NAME),
    leadLastName: blankToNull(env.LEAD_LAST_NAME) ?? DEFAULT_LEAD_LAST_NAME,
    leadZip: normalizeZip(env.DREVVY_ZIP),
    fetchTimeoutMs: positiveInt(env.RESEARCH_FETCH_TIMEOUT_MS, 15_000),
    maxTurns: resolveMaxTurns(env.WIDGET_CHAT_MAX_TURNS),
    scanSettleMs: positiveInt(env.WIDGET_SCAN_SETTLE_MS, 3_000),
    scanConcurrency: positiveInt(env.WIDGET_SCAN_CONCURRENCY, 3),
    scanTimeoutMs: positiveInt(env.WIDGET_SCAN_TIMEOUT_MS, 25_000),
    marketcheckApiKey: blankToNull(env.MARKETCHECK_API_KEY),
    marketcheckBaseUrl: blankToNull(env.MARKETCHECK_BASE_URL) ?? 'https://api.marketcheck.com',
    seedIntervalMs: nonNegativeInt(env.SEED_MIN_INTERVAL_MS, 1_000),
    testMode: env.DREVVY_TEST_MODE === '1' || env.DREVVY_TEST_MODE === 'true',
  };
}

export function resolveMaxTurns(value: string | number | undefined | null): number {
  if (value == null || value === '') return MAX_TURNS_CAP;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return MAX_TURNS_CAP;
  return Math.min(MAX_TURNS_CAP, Math.floor(parsed));
}

export function parseAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function isAllowlisted(vehiclePageUrl: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  let hostname: string;
  try {
    hostname = new URL(vehiclePageUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowlist.some((entry) => {
    try {
      const withScheme = entry.includes('://') ? entry : `https://${entry}`;
      return new URL(withScheme).hostname.toLowerCase() === hostname;
    } catch {
      return false;
    }
  });
}

export function assertShopperFirst(name: string): string {
  const trimmed = name.trim();
  if (!/^[A-Za-z][A-Za-z .'-]{0,39}$/.test(trimmed)) {
    throw new Error('SHOPPER_FIRST_NAME must be a first name only, with no phone number or email.');
  }
  return trimmed;
}

export function assertResearchConfig(config: AppConfig): void {
  if (!config.aiApiKey) throw new Error('AI_API_KEY is required for research.');
  if (!config.aiModel) throw new Error('AI_MODEL is required for research.');
  assertSupabaseConfig(config);
}

export function assertSeedConfig(config: AppConfig): void {
  assertResearchConfig(config);
  if (!config.marketcheckApiKey) {
    throw new Error('MARKETCHECK_API_KEY is required to seed the directory.');
  }
}

export function assertOutreachConfig(config: AppConfig, dryRun: boolean): void {
  assertSupabaseConfig(config);
  if (config.testMode) {
    if (!config.drevvyTextNumber || !normalizePhone(config.drevvyTextNumber)) {
      throw new Error('DREVVY_TEXT_NUMBER must be a valid US phone number.');
    }
    if (!config.drevvyEmail) {
      throw new Error('DREVVY_EMAIL must be a valid email address.');
    }
    if (!config.shopperFirst) {
      throw new Error('SHOPPER_FIRST_NAME is required.');
    }
    assertShopperFirst(config.shopperFirst);
  }
  assertLeadLastName(config.leadLastName);
  if (!dryRun && config.allowlist.length === 0) {
    throw new Error('WIDGET_CHAT_ALLOWLIST is required when DRY_RUN=false. Refusing to send.');
  }
}

export function assertChatConfig(config: AppConfig, dryRun: boolean): void {
  assertOutreachConfig(config, dryRun);
  if (!dryRun) {
    if (!config.aiApiKey) throw new Error('AI_API_KEY is required when DRY_RUN=false.');
    if (!config.aiModel) throw new Error('AI_MODEL is required when DRY_RUN=false.');
  }
}

export function assertSupabaseConfig(config: AppConfig): void {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
}

export function chatSettings(config: AppConfig, contact: ConversationContact | null = null): {
  dryRun: boolean;
  allowlist: string[];
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
  maxTurns: number;
  leadLastName: string;
  leadZip: string | null;
} {
  const preferred = preferConversationContact({
    contact,
    testMode: config.testMode,
    env: {
      shopperFirst: config.shopperFirst,
      email: config.drevvyEmail,
      textNumber: config.drevvyTextNumber,
    },
  });
  if ('error' in preferred) throw new Error(preferred.error);
  return {
    dryRun: config.dryRun,
    allowlist: config.allowlist,
    drevvyTextNumber: preferred.textNumber,
    drevvyEmail: preferred.email,
    shopperFirst: assertShopperFirst(preferred.shopperFirst),
    maxTurns: config.maxTurns,
    leadLastName: assertLeadLastName(config.leadLastName),
    leadZip: config.leadZip,
  };
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function nonNegativeInt(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

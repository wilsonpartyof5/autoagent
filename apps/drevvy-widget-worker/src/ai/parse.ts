import { normalizePrice } from '../research/validate';
import { SCRIPT_IDS, type ScriptId } from '../widgets/script';

export const REPLY_STATUSES = [
  'available',
  'sold',
  'price_given',
  'asked_contact',
  'human_handoff',
  'unknown',
] as const;

export type ReplyStatus = (typeof REPLY_STATUSES)[number];

export type DealerReplyClassification = {
  status: ReplyStatus;
  price: string | null;
  next_message: ScriptId | 'none';
};

export type ResearchExtraction = {
  name: string | null;
  phones: string[];
  emails: string[];
  widgetVendor: string | null;
  confidence: number | null;
};

export function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const value: unknown = JSON.parse(trimmed);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI response was not a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function parseClassification(raw: string): DealerReplyClassification {
  const value = parseJsonObject(raw);
  const status = parseStatus(value.status);
  const price = normalizePrice(typeof value.price === 'string' ? value.price : null);
  return {
    status: status === 'price_given' && !price ? 'unknown' : status,
    price,
    next_message: parseScriptId(value.next_message),
  };
}

export function parseExtraction(raw: string): ResearchExtraction {
  const value = parseJsonObject(raw);
  return {
    name: typeof value.name === 'string' ? value.name : null,
    phones: stringList(value.phones),
    emails: stringList(value.emails),
    widgetVendor: typeof value.widget_vendor === 'string' ? value.widget_vendor : null,
    confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? value.confidence : null,
  };
}

function parseStatus(value: unknown): ReplyStatus {
  if (typeof value === 'string' && (REPLY_STATUSES as readonly string[]).includes(value)) {
    return value as ReplyStatus;
  }
  return 'unknown';
}

function parseScriptId(value: unknown): ScriptId | 'none' {
  if (value === 'none') return 'none';
  if (typeof value === 'string' && (SCRIPT_IDS as readonly string[]).includes(value)) {
    return value as ScriptId;
  }
  return 'none';
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

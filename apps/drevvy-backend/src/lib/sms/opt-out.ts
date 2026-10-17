/**
 * Inbound SMS opt-out detection.
 * STOP-family keywords and "don't text me" replies suppress the number
 * no matter how the opt-out line setting is configured.
 */

const KEYWORDS: Array<{ keyword: string; reason: string }> = [
  { keyword: 'stop all', reason: 'stopall' },
  { keyword: 'stopall', reason: 'stopall' },
  { keyword: 'unsubscribe', reason: 'unsubscribe' },
  { keyword: 'cancel', reason: 'cancel' },
  { keyword: 'quit', reason: 'quit' },
  { keyword: 'stop', reason: 'stop' },
  { keyword: 'end', reason: 'end' },
];

const KEYWORD_TAIL = /^(please|thanks|thank you|now|me|today)?$/;

const PHRASES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bdo not text me\b/, reason: 'do_not_text_me' },
  { pattern: /\bdon't text me\b/, reason: 'dont_text_me' },
  { pattern: /\bdont text me\b/, reason: 'dont_text_me' },
  { pattern: /\bdo not text\b/, reason: 'do_not_text' },
  { pattern: /\bdon't text\b/, reason: 'dont_text' },
  { pattern: /\bdont text\b/, reason: 'dont_text' },
  { pattern: /\bstop texting\b/, reason: 'stop_texting' },
  { pattern: /\bquit texting\b/, reason: 'quit_texting' },
  { pattern: /\bno more texts?\b/, reason: 'no_more_texts' },
  { pattern: /\bdo not message me\b/, reason: 'do_not_message' },
  { pattern: /\bdon't message me\b/, reason: 'dont_message' },
  { pattern: /\bdo not contact me\b/, reason: 'do_not_contact' },
  { pattern: /\bdon't contact me\b/, reason: 'dont_contact' },
  { pattern: /\btake me off\b/, reason: 'take_me_off' },
  { pattern: /\bremove me\b/, reason: 'remove_me' },
  { pattern: /\bopt out\b/, reason: 'opt_out' },
  { pattern: /\bstop all\b/, reason: 'stopall' },
];

export type SmsOptOutDetection =
  | { optedOut: true; reason: string }
  | { optedOut: false };

export function detectSmsOptOut(text: string | null | undefined): SmsOptOutDetection {
  const normalized = normalizeOptOutText(text);
  if (!normalized) return { optedOut: false };

  for (const { keyword, reason } of KEYWORDS) {
    if (normalized === keyword || normalized === `please ${keyword}`) {
      return { optedOut: true, reason };
    }
    if (normalized.startsWith(`${keyword} `)) {
      const rest = normalized.slice(keyword.length + 1).trim();
      if (KEYWORD_TAIL.test(rest)) return { optedOut: true, reason };
    }
  }

  for (const { pattern, reason } of PHRASES) {
    if (pattern.test(normalized)) return { optedOut: true, reason };
  }

  return { optedOut: false };
}

export function normalizeSmsPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function smsThreadKey(input: {
  threadKey?: string | null;
  phone: string;
  dealId?: string | null;
}): string {
  const explicit = input.threadKey?.trim();
  if (explicit && isSafeThreadKey(explicit)) return explicit;
  const dealId = input.dealId?.trim();
  if (dealId && isSafeThreadKey(dealId)) return `${dealId}:${input.phone}`;
  return input.phone;
}

function normalizeOptOutText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSafeThreadKey(value: string): boolean {
  return value.length > 0 && value.length <= 200 && /^[A-Za-z0-9:._+-]+$/.test(value);
}

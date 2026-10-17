import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

type MarketCheckContext = {
  origin: string;
  subjectHash?: string;
};

const store = new AsyncLocalStorage<MarketCheckContext>();

function fallbackOrigin(): string {
  const explicit = process.env.DREVVY_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (!vercel) return '';
  const host = vercel.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return `https://${host}`;
}

export function hashMarketCheckSubject(subject: string): string {
  return createHash('sha256').update(subject).digest('hex').slice(0, 32);
}

export function currentPhotoOrigin(): string {
  const active = store.getStore()?.origin;
  if (active) return active;
  return fallbackOrigin();
}

export function currentSubjectHash(): string | undefined {
  return store.getStore()?.subjectHash;
}

/**
 * Opaque shopper id for cost measurement. Emails and other free text are
 * ignored so the usage log cannot pick up PII from a header.
 */
export function marketCheckSubject(userId: string | undefined, header: string | null): string | undefined {
  if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return userId.toLowerCase();
  }
  if (header && /^[A-Za-z0-9_-]{8,80}$/.test(header)) return header;
  return undefined;
}

export function withMarketCheckContext<T>(
  input: { origin?: string; subject?: string },
  run: () => Promise<T>,
): Promise<T> {
  const parent = store.getStore();
  const origin = (input.origin || parent?.origin || fallbackOrigin()).replace(/\/$/, '');
  const subjectHash = input.subject ? hashMarketCheckSubject(input.subject) : parent?.subjectHash;
  return store.run({ origin, subjectHash }, run);
}

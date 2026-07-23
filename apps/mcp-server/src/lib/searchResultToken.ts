import { createHmac, timingSafeEqual } from 'crypto';
import { CONFIG } from '../config/env.js';

export type SearchResultSnapshot = {
  listingId: string;
  vin: string;
  dealerId: string;
  dealerName: string;
  price: number;
  currency: string;
  provider: 'marketcheck_mcp';
  flowId: string;
  expiresAt: number;
  vehicle: Record<string, unknown>;
};

function key(): Buffer {
  return Buffer.from(CONFIG.leadEncKey, 'base64');
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signature(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url');
}

export function signSearchResult(
  snapshot: Omit<SearchResultSnapshot, 'expiresAt'>,
  ttlMs = 30 * 60 * 1000,
): string {
  const payload = encode(
    JSON.stringify({ ...snapshot, expiresAt: Date.now() + ttlMs }),
  );
  return `${payload}.${signature(payload)}`;
}

export function verifySearchResult(token: string): SearchResultSnapshot {
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) {
    throw new Error('SEARCH_RESULT_TOKEN_INVALID');
  }
  const expected = signature(payload);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new Error('SEARCH_RESULT_TOKEN_INVALID');
  }
  const snapshot = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as SearchResultSnapshot;
  if (snapshot.expiresAt <= Date.now()) {
    throw new Error('SEARCH_RESULT_TOKEN_EXPIRED');
  }
  return snapshot;
}

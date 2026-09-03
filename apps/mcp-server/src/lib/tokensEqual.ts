import { timingSafeEqual } from 'crypto';

/**
 * Compare secrets without leaking length/content via early string inequality.
 */
export function tokensEqual(provided?: string | null, expected?: string | null): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

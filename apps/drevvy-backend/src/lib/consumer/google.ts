import { createHash, createPublicKey, verify, type JsonWebKey } from 'node:crypto';

import { ConsumerAuthError } from './auth';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export const GOOGLE_NOT_CONFIGURED = 'google sign-in not configured';

type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

export function readGoogleClientIds(raw: string | undefined): string[] {
  const ids = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (ids.length === 0) {
    throw new ConsumerAuthError(GOOGLE_NOT_CONFIGURED, 503, 'service_unavailable');
  }
  return ids;
}

export async function verifyGoogleIdToken(input: {
  identityToken: string;
  nonce?: string;
  clientIds: string[];
  now?: Date;
  fetchJwks?: () => Promise<GoogleJwk[]>;
}): Promise<{ sub: string }> {
  const parts = input.identityToken.split('.');
  if (parts.length !== 3) {
    throw rejected();
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (!header || !payload) throw rejected();
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw rejected();
  }

  const keys = await loadKeys(input.fetchJwks);
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw rejected();

  const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = Buffer.from(encodedSignature, 'base64url');
  let valid = false;
  try {
    valid = verify('RSA-SHA256', signed, createPublicKey({ key: jwk, format: 'jwk' }), signature);
  } catch {
    throw rejected();
  }
  if (!valid) throw rejected();

  if (typeof payload.iss !== 'string' || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw rejected();
  }
  if (!audienceAllowed(payload.aud, input.clientIds)) {
    throw rejected();
  }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    throw rejected();
  }
  if (input.nonce && !nonceMatches(payload.nonce, input.nonce)) {
    throw rejected();
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw rejected();
  }
  return { sub: payload.sub };
}

async function loadKeys(fetchJwks: (() => Promise<GoogleJwk[]>) | undefined): Promise<GoogleJwk[]> {
  try {
    if (fetchJwks) return await fetchJwks();
    const response = await fetch(GOOGLE_JWKS_URL);
    if (!response.ok) {
      throw new ConsumerAuthError('Google sign-in could not be checked.', 503, 'google_unavailable');
    }
    const body = await response.json() as { keys?: GoogleJwk[] };
    if (!body.keys || !Array.isArray(body.keys)) {
      throw new ConsumerAuthError('Google sign-in could not be checked.', 503, 'google_unavailable');
    }
    return body.keys;
  } catch (error) {
    if (error instanceof ConsumerAuthError) throw error;
    throw new ConsumerAuthError('Google sign-in could not be checked.', 503, 'google_unavailable');
  }
}

function audienceAllowed(aud: unknown, clientIds: string[]): boolean {
  const values = typeof aud === 'string' ? [aud] : Array.isArray(aud) ? aud.filter((item) => typeof item === 'string') : [];
  return values.some((value) => clientIds.includes(value));
}

function nonceMatches(claim: unknown, nonce: string): boolean {
  if (typeof claim !== 'string' || !claim) return false;
  if (claim === nonce) return true;
  const digest = createHash('sha256').update(nonce).digest();
  return claim === digest.toString('hex') || claim === digest.toString('base64url');
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function rejected(): ConsumerAuthError {
  return new ConsumerAuthError('Google sign-in was rejected.', 401, 'google_rejected');
}

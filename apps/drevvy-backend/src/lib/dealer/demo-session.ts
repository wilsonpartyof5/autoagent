import { createHmac, timingSafeEqual } from 'node:crypto';

import { DEMO_ROOFTOPS } from './demo-org';
import type { DealerSession } from './session';

export const DEMO_DEALER_COOKIE = 'drevvy_demo_desk';
export const DEMO_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const DEMO_EMAIL = 'derek@lakesidehonda.com';

export function demoSessionSecret(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env.SUPABASE_JWT_SECRET || env.CRON_SECRET || '';
  return value.length >= 16 ? value : null;
}

export function demoCookieOptions(maxAge: number, secure: boolean) {
  return {
    httpOnly: true as const,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/** Desk session for the public invite/demo walkthrough. Mock book only. */
export function demoDealerSession(): DealerSession {
  return {
    source: 'demo',
    userId: 'demo-derek-patel',
    email: DEMO_EMAIL,
    displayName: 'Derek Patel',
    initials: 'DP',
    role: 'owner_gm',
    rooftops: DEMO_ROOFTOPS.map((rooftop) => ({
      id: rooftop.id,
      name: rooftop.name,
      role: 'owner_gm' as const,
    })),
    canSwitchAllRooftops: true,
  };
}

export function sealDemoDealerSession(secret: string, now: number, ttlMs = DEMO_SESSION_TTL_MS): string {
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: now + ttlMs }), 'utf8').toString('base64url');
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

export function openDemoDealerSession(
  token: string | undefined,
  secret: string,
  now: number,
): DealerSession | null {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload, secret);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { v?: unknown; exp?: unknown };
    if (parsed.v !== 1 || typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) return null;
    if (parsed.exp <= now) return null;
    if (parsed.exp > now + DEMO_SESSION_TTL_MS + 60_000) return null;
  } catch {
    return null;
  }
  return demoDealerSession();
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Live desk gate. A signed-in membership is not enough: the same user and
 * rooftop need a recorded message-only and itemized-otd commitment.
 * A demo cookie is never that record. A missing table stays closed.
 */

import { localDealerDatabaseEnabled, appAdminClient } from '@/lib/supabase/admin';
import {
  activationDenialMessage,
  evaluateDealerActivation,
  type ActivationDenial,
  type MembershipClaim,
} from './activation';
import { readSupabaseCommitment, recordSupabaseCommitment, type CommitmentQuery } from './activation-store';
import { DEMO_DEALER_COOKIE } from './demo-session';
import { REQUIRED_ONBOARDING_COMMITMENTS } from './onboarding-acceptance';
import { parseRooftopQuery } from './live-store';
import { loadOnboardedRooftops } from './rooftop-store';
import type { DealerSession } from './session';

export type ActivationGateResult =
  | { ok: true; demoCookieIgnored: boolean }
  | { ok: false; code: ActivationDenial; message: string };

function requestHasDemoCookie(request?: Request): boolean {
  const cookie = request?.headers.get('cookie') ?? '';
  return cookie.split(';').some((part) => part.trim().startsWith(`${DEMO_DEALER_COOKIE}=`));
}

function claimsFor(session: DealerSession): MembershipClaim[] {
  return session.rooftops.map((rooftop) => ({
    userId: session.userId,
    rooftopId: rooftop.id,
    role: rooftop.role,
    rooftopName: rooftop.name,
  }));
}

function deny(code: ActivationDenial): ActivationGateResult {
  return { ok: false, code, message: activationDenialMessage(code) };
}

export async function gateLiveDealerSession(
  session: DealerSession,
  request?: Request,
): Promise<ActivationGateResult> {
  if (session.source !== 'live') return deny('unauthenticated');
  const demoCookieProof = requestHasDemoCookie(request);
  try {
    const client = appAdminClient() as unknown as CommitmentQuery;
    const onboarded = await loadOnboardedRooftops(appAdminClient());
    const requested = request ? parseRooftopQuery(request.url) : null;
    if (requested && !session.rooftops.some((rooftop) => rooftop.id === requested)) {
      return deny('unknown_membership');
    }
    const rooftopIds = requested ? [requested] : session.rooftops.map((rooftop) => rooftop.id);
    if (rooftopIds.length === 0) return deny('unknown_membership');

    let demoCookieIgnored = false;
    for (const rooftopId of rooftopIds) {
      const commitment = await readSupabaseCommitment(client, session.userId, rooftopId);
      const decision = evaluateDealerActivation({
        user: { id: session.userId, email: session.email },
        requestedRooftopId: rooftopId,
        memberships: claimsFor(session),
        onboardedRooftopIds: onboarded.map((rooftop) => rooftop.id),
        commitment,
        demoCookieProof,
      });
      if (!decision.ok) return deny(decision.code);
      demoCookieIgnored = demoCookieIgnored || decision.demoCookieIgnored;
    }
    return { ok: true, demoCookieIgnored };
  } catch {
    return deny('commitments_unavailable');
  }
}

type CommitmentPayload = {
  rooftopId?: unknown;
  userId?: unknown;
  email?: unknown;
  commitments?: unknown;
};

export async function acceptDealerCommitments(
  session: DealerSession,
  payload: unknown,
  request?: Request,
): Promise<
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: number; code: ActivationDenial | 'rejected' }
> {
  if (session.source !== 'live') return { ok: false, status: 401, code: 'unauthenticated' };
  const body = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as CommitmentPayload
    : {};
  if (typeof body.email === 'string' && body.email.trim() && body.email.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
    return { ok: false, status: 403, code: 'email_mismatch' };
  }
  if (typeof body.userId === 'string' && body.userId.trim() && body.userId !== session.userId) {
    return { ok: false, status: 403, code: 'membership_mismatch' };
  }
  const rooftopId = typeof body.rooftopId === 'string' ? body.rooftopId.trim() : '';
  const membership = session.rooftops.find((rooftop) => rooftop.id === rooftopId);
  if (!membership) return { ok: false, status: 403, code: 'unknown_membership' };

  const submitted = Array.isArray(body.commitments)
    ? body.commitments.filter((item): item is string => typeof item === 'string')
    : [];
  if (!REQUIRED_ONBOARDING_COMMITMENTS.every((required) => submitted.includes(required))) {
    return { ok: false, status: 400, code: 'commitments_missing' };
  }

  try {
    const onboarded = await loadOnboardedRooftops(appAdminClient());
    if (!onboarded.some((rooftop) => rooftop.id === rooftopId)) {
      return { ok: false, status: 403, code: 'rooftop_not_onboarded' };
    }
    const saved = await recordSupabaseCommitment(appAdminClient() as unknown as CommitmentQuery, {
      userId: session.userId,
      rooftopId,
      commitments: REQUIRED_ONBOARDING_COMMITMENTS,
    });
    if (!saved.ok) return { ok: false, status: 503, code: 'commitments_unavailable' };
    return {
      ok: true,
      status: 200,
      body: {
        persistence: 'recorded',
        database: localDealerDatabaseEnabled() ? 'local-disposable-postgres' : 'configured-service-role',
        ...(localDealerDatabaseEnabled() ? { hostedSupabase: false as const } : {}),
        legalAcceptance: false,
        created: saved.created,
        userId: saved.row.userId,
        rooftopId: saved.row.rooftopId,
        role: membership.role,
        termsVersion: saved.row.termsVersion,
        commitments: saved.row.commitments,
        recordedAt: saved.row.recordedAt,
        demoCookieIgnored: requestHasDemoCookie(request),
      },
    };
  } catch {
    return { ok: false, status: 503, code: 'commitments_unavailable' };
  }
}

export async function readDealerCommitment(
  session: DealerSession,
  rooftopId: string,
  request?: Request,
): Promise<
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: number; code: ActivationDenial }
> {
  if (session.source !== 'live') return { ok: false, status: 401, code: 'unauthenticated' };
  const membership = session.rooftops.find((rooftop) => rooftop.id === rooftopId);
  if (!membership) return { ok: false, status: 403, code: 'unknown_membership' };
  try {
    const read = await readSupabaseCommitment(appAdminClient() as unknown as CommitmentQuery, session.userId, rooftopId);
    if (read.status === 'unavailable') return { ok: false, status: 503, code: 'commitments_unavailable' };
    if (read.status === 'missing') {
      return { ok: false, status: 404, code: requestHasDemoCookie(request) ? 'demo_cookie_rejected' : 'commitments_missing' };
    }
    return {
      ok: true,
      status: 200,
      body: {
        persistence: 'recorded',
        database: localDealerDatabaseEnabled() ? 'local-disposable-postgres' : 'configured-service-role',
        ...(localDealerDatabaseEnabled() ? { hostedSupabase: false as const } : {}),
        legalAcceptance: false,
        userId: read.row.userId,
        rooftopId: read.row.rooftopId,
        role: membership.role,
        termsVersion: read.row.termsVersion,
        commitments: read.row.commitments,
        recordedAt: read.row.recordedAt,
        demoCookieIgnored: requestHasDemoCookie(request),
      },
    };
  } catch {
    return { ok: false, status: 503, code: 'commitments_unavailable' };
  }
}

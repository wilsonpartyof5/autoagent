/**
 * Work email → authenticated user → verified membership → onboarded rooftop.
 *
 * The authenticated user is the Supabase session (id + email). This module
 * does not create users, memberships, or rooftops. A demo desk cookie is never
 * proof of onboarding. A recorded commitment row is required before activation
 * succeeds. The live table is a draft and is not applied here.
 */

import { REQUIRED_ONBOARDING_COMMITMENTS } from './onboarding-acceptance';
import { inNetworkOpener, shopperFirstNameOnly } from './rooftop-match';
import { TERMS_VERSION } from './demo-org';

export const ACTIVATION_TERMS_VERSION = TERMS_VERSION;

export type AuthenticatedWorkUser = {
  id: string;
  email: string;
};

export type MembershipClaim = {
  userId: string;
  rooftopId: string;
  role: string;
  rooftopName: string;
};

export type RecordedCommitment = {
  proof: 'recorded';
  userId: string;
  rooftopId: string;
  termsVersion: string;
  commitments: string[];
  recordedAt: string;
};

export type CommitmentRead =
  | { status: 'recorded'; row: RecordedCommitment }
  | { status: 'missing' }
  | { status: 'unavailable' };

export type ActivationDenial =
  | 'unauthenticated'
  | 'email_mismatch'
  | 'unknown_membership'
  | 'membership_mismatch'
  | 'rooftop_not_onboarded'
  | 'demo_cookie_rejected'
  | 'commitments_missing'
  | 'commitments_unavailable';

export type ActivationDecision =
  | {
    ok: true;
    persistence: 'recorded';
    userId: string;
    email: string;
    rooftopId: string;
    role: string;
    rooftopName: string;
    commitments: readonly string[];
    termsVersion: typeof ACTIVATION_TERMS_VERSION;
    demoCookieIgnored: boolean;
  }
  | { ok: false; code: ActivationDenial };

export type ShopperDeskIdentity = {
  firstName: string | null;
  zip: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function hasWorkEmail(user: AuthenticatedWorkUser | null): user is AuthenticatedWorkUser {
  if (!user?.id.trim()) return false;
  const email = normalizeEmail(user.email);
  return email.includes('@') && !email.startsWith('@') && !email.endsWith('@');
}

function commitmentsMatch(commitments: readonly string[]): boolean {
  return REQUIRED_ONBOARDING_COMMITMENTS.every((required) => commitments.includes(required));
}

function recordedFor(
  read: CommitmentRead,
  userId: string,
  rooftopId: string,
): RecordedCommitment | null {
  if (read.status !== 'recorded') return null;
  const row = read.row;
  if (row.proof !== 'recorded') return null;
  if (row.userId !== userId || row.rooftopId !== rooftopId) return null;
  if (row.termsVersion !== ACTIVATION_TERMS_VERSION) return null;
  if (!commitmentsMatch(row.commitments)) return null;
  return row;
}

/**
 * Deny unknown and mismatched memberships. The demo cookie cannot satisfy
 * the commitment check. An unread commitment table stays unavailable.
 */
export function evaluateDealerActivation(input: {
  user: AuthenticatedWorkUser | null;
  claimedEmail?: string | null;
  requestedRooftopId: string;
  memberships: readonly MembershipClaim[];
  onboardedRooftopIds: readonly string[];
  commitment: CommitmentRead;
  demoCookieProof: boolean;
}): ActivationDecision {
  if (!hasWorkEmail(input.user)) return { ok: false, code: 'unauthenticated' };
  const email = normalizeEmail(input.user.email);
  if (input.claimedEmail != null && input.claimedEmail.trim() && normalizeEmail(input.claimedEmail) !== email) {
    return { ok: false, code: 'email_mismatch' };
  }

  const rooftopId = input.requestedRooftopId.trim();
  if (!rooftopId) return { ok: false, code: 'unknown_membership' };

  const own = input.memberships.filter((row) => row.userId === input.user!.id && row.rooftopId === rooftopId);
  const foreign = input.memberships.some((row) => row.userId !== input.user!.id && row.rooftopId === rooftopId);
  if (own.length === 0 && foreign) return { ok: false, code: 'membership_mismatch' };
  if (own.length === 0) return { ok: false, code: 'unknown_membership' };
  if (!input.onboardedRooftopIds.includes(rooftopId)) return { ok: false, code: 'rooftop_not_onboarded' };

  const recorded = recordedFor(input.commitment, input.user.id, rooftopId);
  if (!recorded) {
    if (input.commitment.status === 'unavailable') return { ok: false, code: 'commitments_unavailable' };
    if (input.demoCookieProof) return { ok: false, code: 'demo_cookie_rejected' };
    return { ok: false, code: 'commitments_missing' };
  }

  return {
    ok: true,
    persistence: 'recorded',
    userId: input.user.id,
    email,
    rooftopId,
    role: own[0].role,
    rooftopName: own[0].rooftopName,
    commitments: REQUIRED_ONBOARDING_COMMITMENTS,
    termsVersion: ACTIVATION_TERMS_VERSION,
    demoCookieIgnored: input.demoCookieProof,
  };
}

/** First name, and a ZIP only when financing already supplied one. Contact fields are dropped. */
export function shopperDeskIdentity(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  financing?: boolean | null;
}): ShopperDeskIdentity {
  const firstName = shopperFirstNameOnly(input.firstName);
  const opener = inNetworkOpener(input.firstName, {
    financing: input.financing,
    zip: input.zip,
  });
  const marker = '. ZIP ';
  const at = opener.lastIndexOf(marker);
  return {
    firstName,
    zip: at >= 0 ? opener.slice(at + marker.length) : null,
  };
}

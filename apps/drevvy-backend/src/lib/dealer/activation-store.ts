/**
 * Commitment reads for dealer activation.
 * The fixture store is test-owned memory. The Supabase reader only selects.
 * It does not insert users, memberships, rooftops, or commitment rows.
 */

import type {
  CommitmentRead,
  MembershipClaim,
  RecordedCommitment,
} from './activation';
import { ACTIVATION_TERMS_VERSION } from './activation';
import { REQUIRED_ONBOARDING_COMMITMENTS } from './onboarding-acceptance';

export const COMMITMENT_TABLE = 'dealer_onboarding_commitments';

export const COMMITMENT_COLUMNS = 'user_id, dealership_id, terms_version, commitments, recorded_at';

type CommitmentRow = {
  user_id?: unknown;
  dealership_id?: unknown;
  terms_version?: unknown;
  commitments?: unknown;
  recorded_at?: unknown;
};

export type CommitmentQuery = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: CommitmentRow | null; error: { message: string } | null }>;
        };
      };
    };
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
};

export function createFixtureCommitmentStore(seed: readonly RecordedCommitment[] = []) {
  const rows = seed.map((row) => ({ ...row, commitments: [...row.commitments] }));
  return {
    persistence: 'test-owned' as const,
    liveWrite: false as const,
    reset() {
      rows.length = 0;
    },
    seed(row: RecordedCommitment) {
      rows.push({ ...row, commitments: [...row.commitments] });
    },
    async read(userId: string, rooftopId: string): Promise<CommitmentRead> {
      const found = rows.find((row) => row.userId === userId && row.rooftopId === rooftopId);
      if (!found) return { status: 'missing' };
      return { status: 'recorded', row: { ...found, commitments: [...found.commitments] } };
    },
  };
}

export function membershipsForUser(
  userId: string,
  rows: readonly MembershipClaim[],
): MembershipClaim[] {
  return rows.filter((row) => row.userId === userId).map((row) => ({ ...row }));
}

function asRecorded(row: CommitmentRow): RecordedCommitment | null {
  if (typeof row.user_id !== 'string' || typeof row.dealership_id !== 'string') return null;
  if (row.terms_version !== ACTIVATION_TERMS_VERSION) return null;
  const rawCommitments = row.commitments;
  const commitments = Array.isArray(rawCommitments)
    ? rawCommitments.filter((item): item is string => typeof item === 'string')
    : null;
  if (!commitments || !Array.isArray(rawCommitments) || commitments.length !== rawCommitments.length) return null;
  if (!REQUIRED_ONBOARDING_COMMITMENTS.every((required) => commitments.includes(required))) return null;
  return {
    proof: 'recorded',
    userId: row.user_id,
    rooftopId: row.dealership_id,
    termsVersion: ACTIVATION_TERMS_VERSION,
    commitments,
    recordedAt: typeof row.recorded_at === 'string' ? row.recorded_at : '',
  };
}

/**
 * Insert the two required commitments once. A second call for the same user
 * and rooftop returns the existing row and does not change recorded_at.
 * This does not insert auth users, memberships, or dealerships.
 */
export async function recordSupabaseCommitment(
  client: CommitmentQuery,
  input: {
    userId: string;
    rooftopId: string;
    commitments: readonly string[];
    recordedAt?: string;
  },
): Promise<
  | { ok: true; row: RecordedCommitment; created: boolean }
  | { ok: false; code: 'unavailable' | 'rejected' }
> {
  if (!REQUIRED_ONBOARDING_COMMITMENTS.every((required) => input.commitments.includes(required))) {
    return { ok: false, code: 'rejected' };
  }
  const existing = await readSupabaseCommitment(client, input.userId, input.rooftopId);
  if (existing.status === 'unavailable') return { ok: false, code: 'unavailable' };
  if (existing.status === 'recorded') return { ok: true, row: existing.row, created: false };

  const inserted = await client.from(COMMITMENT_TABLE).insert({
    user_id: input.userId,
    dealership_id: input.rooftopId,
    terms_version: ACTIVATION_TERMS_VERSION,
    commitments: [...REQUIRED_ONBOARDING_COMMITMENTS],
    recorded_at: input.recordedAt ?? new Date().toISOString(),
  });
  if (inserted.error && !/duplicate key|unique constraint/i.test(inserted.error.message)) {
    return { ok: false, code: 'unavailable' };
  }
  const again = await readSupabaseCommitment(client, input.userId, input.rooftopId);
  if (again.status !== 'recorded') return { ok: false, code: 'unavailable' };
  return { ok: true, row: again.row, created: !inserted.error };
}

/** Select-only. A missing draft table is unavailable, which cannot activate a rooftop. */
export async function readSupabaseCommitment(
  client: CommitmentQuery,
  userId: string,
  rooftopId: string,
): Promise<CommitmentRead> {
  const loaded = await client
    .from(COMMITMENT_TABLE)
    .select(COMMITMENT_COLUMNS)
    .eq('user_id', userId)
    .eq('dealership_id', rooftopId)
    .maybeSingle();
  if (loaded.error) return { status: 'unavailable' };
  if (!loaded.data) return { status: 'missing' };
  const row = asRecorded(loaded.data);
  if (!row) return { status: 'missing' };
  return { status: 'recorded', row };
}

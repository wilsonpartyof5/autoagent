import { shopperFirstNameOnly } from '@/lib/dealer/rooftop-match';

/**
 * Shopper profile fields the app may show.
 * First name is the first token only. ZIP is a five-digit market area.
 * Email, phone, and street address are not accepted and are not returned.
 */

export const PROFILE_RESPONSE_KEYS = [
  'consumerUserId',
  'status',
  'firstName',
  'zip',
  'createdAt',
  'updatedAt',
] as const;

export type ShopperProfile = {
  consumerUserId: string;
  status: 'active' | 'disabled' | null;
  firstName: string | null;
  zip: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProfilePatch = {
  firstName?: string | null;
  zip?: string | null;
};

const PATCH_KEYS = new Set(['firstName', 'zip']);

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

export function presentProfile(row: {
  userId: string;
  status: string | null;
  firstName: string | null;
  zip: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): ShopperProfile {
  const status = row.status === 'active' || row.status === 'disabled' ? row.status : null;
  return {
    consumerUserId: row.userId,
    status,
    firstName: shopperFirstNameOnly(row.firstName),
    zip: storedZip(row.zip),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function readProfilePatch(body: unknown): ProfilePatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ProfileError('Send a first name or ZIP.', 400, 'invalid_request');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!PATCH_KEYS.has(key)) {
      throw new ProfileError(
        'Only a first name and ZIP can be saved on this profile.',
        400,
        'profile_field_rejected',
      );
    }
  }
  if (!('firstName' in record) && !('zip' in record)) {
    throw new ProfileError('Send a first name or ZIP.', 400, 'invalid_request');
  }

  const patch: ProfilePatch = {};
  if ('firstName' in record) patch.firstName = parseFirstName(record.firstName);
  if ('zip' in record) patch.zip = parseZip(record.zip);
  return patch;
}

export function profileColumns(options?: { zip?: boolean }): string {
  if (options?.zip === false) return 'user_id, status, first_name, created_at, updated_at';
  return 'user_id, status, first_name, zip, created_at, updated_at';
}

type ProfileQueryError = { message?: string; code?: string } | null;
type ProfileQueryResult = { data: unknown; error: ProfileQueryError };

/** True when consumer_profiles.zip is not in this database yet. */
export function isMissingZipColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { message?: string; code?: string };
  const code = record.code ?? '';
  const message = (record.message ?? '').toLowerCase();
  const missing = code === '42703'
    || code === 'PGRST204'
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find');
  return missing && message.includes('zip');
}

/**
 * Reads the shopper profile. A missing zip column is retried without it so
 * GET /api/consumer/profile stays up before that migration is applied.
 */
export async function readProfileRow(
  query: (columns: string) => PromiseLike<ProfileQueryResult>,
): Promise<unknown> {
  const first = await query(profileColumns());
  if (first.error && isMissingZipColumn(first.error)) {
    const second = await query(profileColumns({ zip: false }));
    if (second.error) throw new Error(second.error.message ?? 'profile read failed');
    return second.data;
  }
  if (first.error) throw new Error(first.error.message ?? 'profile read failed');
  return first.data;
}

/**
 * Writes first name and ZIP. If zip is not a column yet, the name is still
 * saved and zip comes back null instead of failing the request.
 */
export async function writeProfileRow(
  write: (values: Record<string, unknown>, columns: string) => PromiseLike<ProfileQueryResult>,
  patch: ProfilePatch,
): Promise<unknown> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('firstName' in patch) update.first_name = patch.firstName ?? null;
  if ('zip' in patch) update.zip = patch.zip ?? null;

  let result = await write(update, profileColumns());
  if (result.error && isMissingZipColumn(result.error)) {
    const withoutZip = { ...update };
    delete withoutZip.zip;
    result = await write(withoutZip, profileColumns({ zip: false }));
  }
  if (result.error) {
    const message = result.error.message ?? '';
    if (/zip/i.test(message)) throw new ProfileError('Enter a 5-digit ZIP.', 400, 'invalid_zip');
    if (/first_name/i.test(message)) throw new ProfileError('Enter a first name.', 400, 'invalid_first_name');
    throw new Error(message || 'profile update failed');
  }
  return result.data;
}

function parseFirstName(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ProfileError('Enter a first name.', 400, 'invalid_first_name');
  }
  const first = shopperFirstNameOnly(value);
  if (!first) {
    throw new ProfileError('Enter a first name.', 400, 'invalid_first_name');
  }
  return first;
}

function parseZip(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ProfileError('Enter a 5-digit ZIP.', 400, 'invalid_zip');
  }
  const match = value.trim().match(/^(\d{5})(?:-\d{4})?$/);
  if (!match) {
    throw new ProfileError('Enter a 5-digit ZIP.', 400, 'invalid_zip');
  }
  return match[1];
}

function storedZip(value: string | null): string | null {
  if (!value) return null;
  return /^\d{5}$/.test(value) ? value : null;
}

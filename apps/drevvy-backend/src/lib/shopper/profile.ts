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

export function profileColumns(): string {
  return 'user_id, status, first_name, zip, created_at, updated_at';
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

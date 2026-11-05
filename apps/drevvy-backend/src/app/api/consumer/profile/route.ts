import { NextRequest, NextResponse } from 'next/server';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import {
  presentProfile,
  profileColumns,
  ProfileError,
  readProfilePatch,
} from '@/lib/shopper/profile';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET  /api/consumer/profile
 * PATCH /api/consumer/profile
 *
 * Shopper JWT. Returns first name and an optional five-digit ZIP.
 * Contact fields are not read or written.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const { data, error } = await auth.supabase
      .from('consumer_profiles')
      .select(profileColumns())
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data: profileFromRow(auth.userId, data) });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const patch = readProfilePatch(await readRequestJson(request));
    const update: { first_name?: string | null; zip?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if ('firstName' in patch) update.first_name = patch.firstName ?? null;
    if ('zip' in patch) update.zip = patch.zip ?? null;

    const { data, error } = await createAdminClient()
      .from('consumer_profiles')
      .update(update)
      .eq('user_id', auth.userId)
      .select(profileColumns())
      .maybeSingle();
    if (error) {
      if (/zip/i.test(error.message)) {
        throw new ProfileError('Enter a 5-digit ZIP.', 400, 'invalid_zip');
      }
      if (/first_name/i.test(error.message)) {
        throw new ProfileError('Enter a first name.', 400, 'invalid_first_name');
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new ProfileError('Profile not found.', 404, 'profile_missing');
    }
    return NextResponse.json({ success: true, data: profileFromRow(auth.userId, data) });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

function profileFromRow(userId: string, data: unknown) {
  const row = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  return presentProfile({
    userId,
    status: text(row?.status),
    firstName: text(row?.first_name),
    zip: text(row?.zip),
    createdAt: text(row?.created_at),
    updatedAt: text(row?.updated_at),
  });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function profileErrorResponse(error: unknown): NextResponse {
  if (error instanceof ProfileError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return consumerAuthErrorResponse(error);
}

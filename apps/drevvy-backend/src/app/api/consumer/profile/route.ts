import { NextRequest, NextResponse } from 'next/server';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';
import { handleConsumerProfileDelete } from '@/lib/shopper/account-deletion';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import {
  presentProfile,
  ProfileError,
  readProfilePatch,
  readProfileRow,
  writeProfileRow,
} from '@/lib/shopper/profile';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET    /api/consumer/profile
 * PATCH  /api/consumer/profile
 * DELETE /api/consumer/profile
 *
 * Shopper JWT. GET and PATCH return first name and an optional five-digit ZIP.
 * Contact fields are not read or written.
 * DELETE removes the shopper account. Contract: 200 { deleted: true }.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const data = await readProfileRow((columns) => auth.supabase
      .from('consumer_profiles')
      .select(columns)
      .eq('user_id', auth.userId)
      .maybeSingle());
    return NextResponse.json({ success: true, data: profileFromRow(auth.userId, data) });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const patch = readProfilePatch(await readRequestJson(request));
    const data = await writeProfileRow(
      (values, columns) => createAdminClient()
        .from('consumer_profiles')
        .update(values)
        .eq('user_id', auth.userId)
        .select(columns)
        .maybeSingle(),
      patch,
    );
    if (!data) {
      throw new ProfileError('Profile not found.', 404, 'profile_missing');
    }
    return NextResponse.json({ success: true, data: profileFromRow(auth.userId, data) });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  return handleConsumerProfileDelete(request);
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

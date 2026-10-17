import { NextRequest, NextResponse } from 'next/server';

import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { safeRecordingPath } from '@/lib/brain/telnyx';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;

  const path = safeRecordingPath(request.nextUrl.searchParams.get('path') ?? '');
  if (!path) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('call-recordings').download(path);
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const bytes = Buffer.from(await data.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, max-age=60',
      'Content-Disposition': 'inline; filename="call.mp3"',
    },
  });
}

import { notFound, redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { adminPreviewEnabled, isAllowlistedAdmin, parseAdminEmails } from './access';

export async function requireAdmin(): Promise<{ email: string }> {
  if (adminPreviewEnabled()) return { email: 'preview@local' };
  if (parseAdminEmails(process.env.ADMIN_EMAILS).length === 0) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?next=/admin');
  if (!isAllowlistedAdmin(user.email)) notFound();
  return { email: user.email ?? '' };
}

export async function requireAdminApi(): Promise<{ email: string } | NextResponse> {
  if (adminPreviewEnabled()) return { email: 'preview@local' };
  if (parseAdminEmails(process.env.ADMIN_EMAILS).length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowlistedAdmin(user.email)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return { email: user.email ?? '' };
}

export function isAdminAuthFailure(result: { email: string } | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

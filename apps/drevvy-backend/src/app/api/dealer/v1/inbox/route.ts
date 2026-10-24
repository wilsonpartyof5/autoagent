import { NextResponse } from 'next/server';

import { inboxHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = inboxHttp(request.url);
  return NextResponse.json(result.body, { status: result.status });
}

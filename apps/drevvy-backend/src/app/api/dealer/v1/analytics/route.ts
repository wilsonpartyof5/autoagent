import { NextResponse } from 'next/server';

import { analyticsHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = analyticsHttp(request.url);
  return NextResponse.json(result.body, { status: result.status });
}

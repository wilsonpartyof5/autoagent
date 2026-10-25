import { NextResponse } from 'next/server';

import { billingHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = billingHttp();
  return NextResponse.json(result.body, { status: result.status });
}

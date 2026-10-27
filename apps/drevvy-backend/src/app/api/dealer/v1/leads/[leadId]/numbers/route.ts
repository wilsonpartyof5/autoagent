import { NextResponse } from 'next/server';

import { shareNumbersHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const payload = await request.json().catch(() => null);
  const result = shareNumbersHttp(leadId, payload);
  return NextResponse.json(result.body, { status: result.status });
}

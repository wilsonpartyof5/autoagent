import { NextResponse } from 'next/server';

import { markSoldHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const result = markSoldHttp(leadId);
  return NextResponse.json(result.body, { status: result.status });
}

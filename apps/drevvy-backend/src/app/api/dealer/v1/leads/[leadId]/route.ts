import { NextResponse } from 'next/server';

import { conversationHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const result = conversationHttp(leadId);
  return NextResponse.json(result.body, { status: result.status });
}

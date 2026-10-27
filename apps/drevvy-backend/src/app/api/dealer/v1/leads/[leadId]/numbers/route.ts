import { NextResponse } from 'next/server';

import { shareNumbersHttp } from '@/lib/dealer/mock';
import { persistLiveOtdReply } from '@/lib/dealer/otd-warnings';

export const dynamic = 'force-dynamic';

function numbersReply(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const note = typeof record.note === 'string' ? record.note.trim() : '';
  const price = typeof record.statedPriceCents === 'number' ? record.statedPriceCents / 100 : null;
  const otd = typeof record.writtenOtdCents === 'number' ? record.writtenOtdCents / 100 : null;
  const lines = [
    price != null ? `Price $${price}.` : '',
    otd != null ? `Written out-the-door $${otd}.` : '',
    note,
  ];
  return lines.filter(Boolean).join(' ');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const payload = await request.json().catch(() => null);
  const result = shareNumbersHttp(leadId, payload);
  const reply = numbersReply(payload);
  if (reply) await persistLiveOtdReply(leadId, reply);
  return NextResponse.json(result.body, { status: result.status });
}

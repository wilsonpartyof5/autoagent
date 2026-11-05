import { NextResponse } from 'next/server';

import { openIsolatedThread, threadFixtureEnabled } from '@/lib/dealer/isolated-thread';

export const dynamic = 'force-dynamic';

/**
 * Opens one isolated preview thread. Refused in production and unless
 * DEALER_THREAD_FIXTURE=1. Does not write a live rooftop or accept legal terms.
 */
export async function POST(request: Request) {
  if (!threadFixtureEnabled()) {
    return NextResponse.json({ success: false, error: { code: 'not_found', message: 'Not found.' } }, { status: 404 });
  }
  const payload = await request.json().catch(() => null);
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const network = record.network === 'off_network' ? 'off_network' : 'in_network';
  const result = openIsolatedThread({
    firstName: typeof record.firstName === 'string' ? record.firstName : null,
    lastName: typeof record.lastName === 'string' ? record.lastName : null,
    email: typeof record.email === 'string' ? record.email : null,
    phone: typeof record.phone === 'string' ? record.phone : null,
    address: typeof record.address === 'string' ? record.address : null,
    zip: typeof record.zip === 'string' ? record.zip : null,
    financing: record.financing === true,
    network,
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error, source: 'test-owned', liveSystems: false }, { status: result.status });
  }
  return NextResponse.json({ success: true, source: 'test-owned', data: result.thread });
}

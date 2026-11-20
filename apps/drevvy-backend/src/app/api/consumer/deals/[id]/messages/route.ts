import { NextResponse } from 'next/server';

import {
  isolatedShopperThread,
  isIsolatedThreadId,
  postIsolatedShopperMessage,
  threadFixtureEnabled,
} from '@/lib/dealer/isolated-thread';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';
import { postShopperThreadMessage, readShopperThread } from '@/lib/shopper/thread';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function fixtureRequested(request: Request): boolean {
  return threadFixtureEnabled() && request.headers.get('x-drevvy-fixture') === 'isolated';
}

function readBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const body = (payload as { body?: unknown }).body;
  return typeof body === 'string' ? body : '';
}

/**
 * GET/POST /api/consumer/deals/:id/messages
 *
 * Live: the signed-in shopper's in-app thread on shopper_dealer_messages.
 * Isolated: header x-drevvy-fixture: isolated plus DEALER_THREAD_FIXTURE=1,
 * non-production only. That path is labeled test-owned and is not live.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (fixtureRequested(request) && isIsolatedThreadId(id)) {
    const thread = isolatedShopperThread(id);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: { code: 'not_found', message: 'That fixture thread does not exist.' }, source: 'test-owned', liveSystems: false },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, source: 'test-owned', data: thread });
  }
  try {
    const auth = await requireShopperAuth(request);
    const data = await readShopperThread(createAdminClient(), auth.userId, id);
    return NextResponse.json({ success: true, source: 'live', data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (fixtureRequested(request) && isIsolatedThreadId(id)) {
    const result = postIsolatedShopperMessage(id, readBody(payload));
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, source: 'test-owned', liveSystems: false },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, source: 'test-owned', data: result.thread });
  }
  try {
    const auth = await requireShopperAuth(request);
    const data = await postShopperThreadMessage(createAdminClient(), auth.userId, id, readBody(payload));
    return NextResponse.json({ success: true, source: 'live', data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

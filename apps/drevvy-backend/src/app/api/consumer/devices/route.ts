import { NextRequest, NextResponse } from 'next/server';

import { readRequestJson } from '@/lib/shopper/deal-actions';
import { requireShopperAuth } from '@/lib/shopper/session';
import { pushErrorResponse } from '@/lib/push/http';
import { readDeviceToken, registerDeviceToken, unregisterDeviceToken } from '@/lib/push/tokens';

/**
 * POST /api/consumer/devices
 * DELETE /api/consumer/devices
 *
 * Registers or removes an FCM device token for the signed-in shopper.
 * Body: { "token": "..." }
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const token = readDeviceToken(await readRequestJson(request));
    await registerDeviceToken(auth.userId, token);
    return NextResponse.json({ success: true, data: { registered: true } });
  } catch (error) {
    return pushErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const token = readDeviceToken(await readRequestJson(request));
    const removed = await unregisterDeviceToken(auth.userId, token);
    return NextResponse.json({ success: true, data: { removed } });
  } catch (error) {
    return pushErrorResponse(error);
  }
}

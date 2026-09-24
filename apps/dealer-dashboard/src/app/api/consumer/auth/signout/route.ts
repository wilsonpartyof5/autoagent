import { NextRequest, NextResponse } from 'next/server';

import {
  consumerAuthErrorResponse,
  recordConsumerAuthEvent,
  requireConsumerAuth,
} from '@/lib/consumer/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.signOut(auth.token);
    if (error) throw new Error(error.message);
    await recordConsumerAuthEvent({
      eventName: 'consumer_signed_out',
      consumerUserId: auth.userId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}

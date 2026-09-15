import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DealerMobileApiError,
  dealerMobileErrorResponse,
  requireDealerMobileAuth,
} from '@/lib/dealer-mobile/auth';

export const runtime = 'nodejs';

const deviceRequest = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{32,256}$/i),
  platform: z.literal('ios'),
});

export async function POST(request: Request) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const parsed = deviceRequest.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new DealerMobileApiError(
        'The phone notification token is invalid.',
        400,
        'invalid_device_token',
      );
    }

    const now = new Date().toISOString();
    const { error } = await auth.supabase
      .from('dealer_mobile_devices')
      .upsert(
        {
          user_id: auth.user.id,
          token: parsed.data.token.toLowerCase(),
          platform: 'ios',
          enabled: true,
          updated_at: now,
        },
        { onConflict: 'token' },
      );

    if (error) {
      console.error('[dealer-mobile] Failed to register device:', error);
      throw new DealerMobileApiError(
        'This phone could not be registered for notifications.',
        409,
        'device_registration_failed',
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const token = new URL(request.url).searchParams.get('token')?.toLowerCase();
    if (!token || !/^[a-f0-9]{32,256}$/i.test(token)) {
      throw new DealerMobileApiError(
        'The phone notification token is invalid.',
        400,
        'invalid_device_token',
      );
    }

    const { error } = await auth.supabase
      .from('dealer_mobile_devices')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('token', token);

    if (error) {
      throw new DealerMobileApiError(
        'This phone could not be removed from notifications.',
        500,
        'device_removal_failed',
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}

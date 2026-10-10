import { NextRequest, NextResponse } from 'next/server';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const { data, error } = await auth.supabase
      .from('consumer_profiles')
      .select('user_id, status, created_at, updated_at')
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        consumerUserId: auth.userId,
        status: data?.status ?? null,
        createdAt: data?.created_at ?? null,
        updatedAt: data?.updated_at ?? null,
      },
    });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}

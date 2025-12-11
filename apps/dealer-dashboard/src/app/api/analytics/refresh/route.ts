/**
 * Phase 4: Analytics View Refresh Endpoint
 * 
 * Refreshes materialized views. Can be called via cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ANALYTICS_REFRESH_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Call refresh function
    const { data, error } = await supabase.rpc('check_and_refresh_analytics_views');

    if (error) {
      console.error('[api/analytics/refresh] Error refreshing views:', error);
      return NextResponse.json(
        { error: 'Failed to refresh views', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/analytics/refresh] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET for manual refresh
export async function GET() {
  return POST(new NextRequest('http://localhost/api/analytics/refresh', { method: 'POST' }));
}


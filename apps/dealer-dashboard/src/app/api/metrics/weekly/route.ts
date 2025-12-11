/**
 * Phase 4: Weekly Metrics API Endpoint
 * 
 * Returns weekly aggregated metrics from materialized view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveDealership } from '@/lib/supabase/dealerships';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weeks = parseInt(searchParams.get('weeks') || '4', 10);
    const dealerIdParam = searchParams.get('dealer_id');

    // Authenticate user first
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get dealer ID from query param or active dealership
    let dealerId: string | null = dealerIdParam;
    if (!dealerId) {
      const activeDealership = await getActiveDealership();
      dealerId = activeDealership?.marketcheckDealerId ?? null;
    }

    if (!dealerId) {
      return NextResponse.json(
        { error: 'Dealer ID required' },
        { status: 400 }
      );
    }
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));
    const startDateStr = startDate.toISOString().split('T')[0];

    // Query materialized view
    const { data, error } = await supabase
      .from('weekly_metrics_per_dealer')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('week_start', startDateStr)
      .order('week_start', { ascending: false });

    if (error) {
      console.error('[api/metrics/weekly] Error', error);
      return NextResponse.json(
        { error: 'Failed to fetch weekly metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      dealerId,
      weeks,
    });
  } catch (error) {
    console.error('[api/metrics/weekly] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Phase 4: Monthly Metrics API Endpoint
 * 
 * Returns monthly aggregated metrics from materialized view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveDealership } from '@/lib/supabase/dealerships';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '6', 10);
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
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Query materialized view
    const { data, error } = await supabase
      .from('monthly_metrics_per_dealer')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('month_start', startDateStr)
      .order('month_start', { ascending: false });

    if (error) {
      console.error('[api/metrics/monthly] Error', error);
      return NextResponse.json(
        { error: 'Failed to fetch monthly metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      dealerId,
      months,
    });
  } catch (error) {
    console.error('[api/metrics/monthly] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

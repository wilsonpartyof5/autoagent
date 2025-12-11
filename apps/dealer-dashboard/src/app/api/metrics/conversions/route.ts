/**
 * Phase 4: Conversion Metrics API Endpoint
 * 
 * Returns conversion-related metrics (search to lead conversion) for the active dealership.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveDealership } from '@/lib/supabase/dealerships';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dealerIdParam = searchParams.get('dealer_id');

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
      return NextResponse.json({ 
        error: 'Dealer ID required',
        data: {
          conversionRate: 0,
          totalSearches: 0,
          totalConversions: 0,
          averageHoursToConvert: 0,
        }
      }, { status: 400 });
    }

    // Query conversion metrics from view
    const { data: conversionData, error } = await supabase
      .from('search_to_lead_conversion')
      .select('*')
      .eq('dealer_id', dealerId)
      .maybeSingle();

    if (error) {
      console.error('[metrics/conversions] Error fetching conversion metrics:', error);
      // Return zero values instead of error
      return NextResponse.json({
        success: true,
        data: {
          conversionRate: 0,
          totalSearches: 0,
          totalConversions: 0,
          averageHoursToConvert: 0,
        },
        dealerId,
      });
    }

    // Get last refresh timestamp from analytics_refresh_state
    const { data: refreshState } = await supabase
      .from('analytics_refresh_state')
      .select('last_refresh')
      .eq('id', 'single')
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        conversionRate: conversionData?.conversion_rate_percent || 0,
        totalSearches: conversionData?.total_searches || 0,
        totalConversions: conversionData?.conversions || 0,
        averageHoursToConvert: conversionData?.avg_hours_to_convert || 0,
      },
      dealerId,
      // Include freshness indicator
      metadata: {
        lastRefresh: refreshState?.last_refresh || null,
        dataFreshness: refreshState?.last_refresh 
          ? `Refreshed ${Math.round((Date.now() - new Date(refreshState.last_refresh).getTime()) / 60000)} minutes ago`
          : 'Unknown',
      },
    });
  } catch (error) {
    console.error('[metrics/conversions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

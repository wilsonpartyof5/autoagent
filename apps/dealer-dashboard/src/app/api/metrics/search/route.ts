/**
 * Phase 4: Search Metrics API Endpoint
 * 
 * Returns search-related metrics for the active dealership.
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
          totalSearches: 0,
          searchesToday: 0,
          searchesThisWeek: 0,
          searchesThisMonth: 0,
          topFilters: [],
          averageResultsPerSearch: 0,
        }
      }, { status: 400 });
    }

    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartStr = todayStart.toISOString();

    // Get week start (last 7 days)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString();

    // Get month start (last 30 days)
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    const monthStartStr = monthStart.toISOString();

    // Query search counts
    const [todayCount, weekCount, monthCount, totalCount, recentSearches] = await Promise.all([
      // Today's searches
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'inventory.search')
        .eq('dealer_id', dealerId)
        .gte('timestamp', todayStartStr),
      
      // Week's searches
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'inventory.search')
        .eq('dealer_id', dealerId)
        .gte('timestamp', weekStartStr),
      
      // Month's searches
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'inventory.search')
        .eq('dealer_id', dealerId)
        .gte('timestamp', monthStartStr),
      
      // Total searches (all time)
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'inventory.search')
        .eq('dealer_id', dealerId),
      
      // Recent searches with payload
      supabase
        .from('analytics_events')
        .select('id, payload, timestamp')
        .eq('event_name', 'inventory.search')
        .eq('dealer_id', dealerId)
        .gte('timestamp', startDateStr)
        .order('timestamp', { ascending: false })
        .limit(100),
    ]);

    // Calculate average results per search
    let averageResultsPerSearch = 0;
    if (recentSearches.data && recentSearches.data.length > 0) {
      const totalResults = recentSearches.data.reduce((sum, event) => {
        const payload = event.payload as { resultsCount?: number };
        return sum + (payload?.resultsCount || 0);
      }, 0);
      averageResultsPerSearch = Math.round(totalResults / recentSearches.data.length);
    }

    // Extract top filters (simplified - can be enhanced)
    const topFilters: Array<{ filter: string; count: number }> = [];
    if (recentSearches.data) {
      const filterCounts: Record<string, number> = {};
      recentSearches.data.forEach((event) => {
        const payload = event.payload as { make?: string; model?: string };
        if (payload?.make) {
          filterCounts[`make:${payload.make}`] = (filterCounts[`make:${payload.make}`] || 0) + 1;
        }
        if (payload?.model) {
          filterCounts[`model:${payload.model}`] = (filterCounts[`model:${payload.model}`] || 0) + 1;
        }
      });
      topFilters.push(
        ...Object.entries(filterCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([filter, count]) => ({ filter, count }))
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSearches: totalCount.count || 0,
        searchesToday: todayCount.count || 0,
        searchesThisWeek: weekCount.count || 0,
        searchesThisMonth: monthCount.count || 0,
        topFilters,
        averageResultsPerSearch,
      },
      dealerId,
    });
  } catch (error) {
    console.error('[metrics/search] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

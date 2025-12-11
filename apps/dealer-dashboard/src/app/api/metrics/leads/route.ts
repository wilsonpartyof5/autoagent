/**
 * Phase 4: Leads Metrics API Endpoint
 * 
 * Returns lead-related metrics for the active dealership.
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
          totalLeads: 0,
          leadsToday: 0,
          leadsThisWeek: 0,
          leadsThisMonth: 0,
          recentLeads: [],
        }
      }, { status: 400 });
    }

    const limit = parseInt(searchParams.get('limit') || '10', 10);
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

    // Query recent leads from analytics_events with UVS vehicle join
    const { data: recentLeads, error: leadsError } = await supabase
      .from('analytics_events')
      .select(`
        id,
        vehicle_id,
        vin,
        timestamp,
        payload,
        uvs_vehicles!inner(
          id,
          vin,
          year,
          make,
          model,
          trim
        )
      `)
      .eq('event_name', 'lead.submit')
      .eq('dealer_id', dealerId)
      .gte('timestamp', startDateStr)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (leadsError) {
      console.error('[metrics/leads] Error fetching leads:', leadsError);
    }

    // Query counts
    const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
      // Today's leads
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'lead.submit')
        .eq('dealer_id', dealerId)
        .gte('timestamp', todayStartStr),
      
      // Week's leads
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'lead.submit')
        .eq('dealer_id', dealerId)
        .gte('timestamp', weekStartStr),
      
      // Month's leads
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'lead.submit')
        .eq('dealer_id', dealerId)
        .gte('timestamp', monthStartStr),
      
      // Total leads (all time)
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'lead.submit')
        .eq('dealer_id', dealerId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalLeads: totalCount.count || 0,
        leadsToday: todayCount.count || 0,
        leadsThisWeek: weekCount.count || 0,
        leadsThisMonth: monthCount.count || 0,
        recentLeads: recentLeads || [],
      },
      dealerId,
    });
  } catch (error) {
    console.error('[metrics/leads] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Phase 4: Comprehensive KPI Metrics API Endpoint
 * 
 * Returns KPIs for leadership, sales, and internal reliability.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveDealership } from '@/lib/supabase/dealerships';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const dealerIdParam = searchParams.get('dealer_id');
    const days = parseInt(searchParams.get('days') || '30', 10);

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
          leadership: {},
          sales: {},
          internalReliability: {},
        }
      }, { status: 400 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // ============================================
    // Leadership KPIs
    // ============================================
    const [totalLeads, leadsGrowth, vehiclesWithLeads, conversionRate] = await Promise.all([
      // Total leads (all time)
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'lead.submit')
        .eq('dealer_id', dealerId),
      
      // Leads growth (this period vs last period)
      Promise.all([
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'lead.submit')
          .eq('dealer_id', dealerId)
          .gte('timestamp', startDateStr),
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'lead.submit')
          .eq('dealer_id', dealerId)
          .gte('timestamp', new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000).toISOString())
          .lt('timestamp', startDateStr),
      ]).then(([current, previous]) => ({
        current: current.count || 0,
        previous: previous.count || 0,
        growthPercent: previous.count ? ((current.count || 0) - (previous.count || 0)) / previous.count * 100 : 0,
      })),
      
      // Unique vehicles with leads
      supabase
        .from('analytics_events')
        .select('vehicle_id')
        .eq('event_name', 'lead.submit')
        .eq('dealer_id', dealerId)
        .not('vehicle_id', 'is', null),
      
      // Conversion rate from materialized view
      supabase
        .from('search_to_lead_conversion')
        .select('conversion_rate_percent')
        .eq('dealer_id', dealerId)
        .maybeSingle(),
    ]);

    const uniqueVehiclesWithLeads = new Set(
      (vehiclesWithLeads.data || []).map(e => e.vehicle_id).filter(Boolean)
    ).size;

    const leadershipKPIs = {
      totalLeads: totalLeads.count || 0,
      leadsGrowthPercent: leadsGrowth.growthPercent,
      uniqueVehiclesWithLeads,
      conversionRate: conversionRate.data?.conversion_rate_percent || 0,
      marketShare: null, // Requires industry comparison data (not available)
    };

    // ============================================
    // Sales KPIs
    // ============================================
    const [searchCount, avgTimeToConvert, topPerformingVehicles] = await Promise.all([
      // Total searches
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'inventory.search')
        .eq('dealer_id', dealerId)
        .gte('timestamp', startDateStr),
      
      // Average time to convert (from materialized view)
      supabase
        .from('search_to_lead_conversion')
        .select('avg_hours_to_convert')
        .eq('dealer_id', dealerId)
        .maybeSingle(),
      
      // Top performing vehicles (most leads) - join via UVS FK
      supabase
        .from('analytics_events')
        .select(`
          vehicle_id,
          vin,
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
        .not('vehicle_id', 'is', null),
    ]);

    // Calculate top performing vehicles with UVS data
    const vehicleLeadCounts: Record<string, { 
      count: number; 
      vin?: string;
      year?: number;
      make?: string;
      model?: string;
      trim?: string;
    }> = {};
    (topPerformingVehicles.data || []).forEach(event => {
      const vid = event.vehicle_id as string;
      const uvsVehicle = (event as any).uvs_vehicles;
      if (!vehicleLeadCounts[vid]) {
        vehicleLeadCounts[vid] = { 
          count: 0, 
          vin: uvsVehicle?.vin || event.vin as string | undefined,
          year: uvsVehicle?.year,
          make: uvsVehicle?.make,
          model: uvsVehicle?.model,
          trim: uvsVehicle?.trim,
        };
      }
      vehicleLeadCounts[vid].count++;
    });

    const topVehicles = Object.entries(vehicleLeadCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([vehicleId, data]) => ({ 
        vehicleId, 
        leadCount: data.count, 
        vin: data.vin,
        year: data.year,
        make: data.make,
        model: data.model,
        trim: data.trim,
      }));

    const salesKPIs = {
      searchToLeadConversionRate: conversionRate.data?.conversion_rate_percent || 0,
      averageTimeToConvertHours: avgTimeToConvert.data?.avg_hours_to_convert || 0,
      totalSearches: searchCount.count || 0,
      topPerformingVehicles: topVehicles,
      leadQualityScore: null, // Requires lead scoring algorithm (not implemented)
    };

    // ============================================
    // Internal Reliability KPIs
    // ============================================
    const [totalEvents, errorEvents, recentActivity] = await Promise.all([
      // Total events (system usage)
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', dealerId)
        .gte('timestamp', startDateStr),
      
      // Error events (if we track them)
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'system.error')
        .eq('dealer_id', dealerId)
        .gte('timestamp', startDateStr),
      
      // Recent activity check (events in last hour)
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', dealerId)
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    ]);

    const errorRate = totalEvents.count
      ? ((errorEvents.count || 0) / totalEvents.count) * 100
      : 0;

    // Calculate actual metrics from real events
    const systemUptimePercent = totalEvents.count 
      ? Math.max(0, 100 - errorRate) 
      : null; // null if no data yet
    
    const dataQualityScore = totalEvents.count
      ? Math.max(0, 100 - errorRate)
      : null; // null if no data yet

    const internalReliabilityKPIs = {
      systemUptimePercent: systemUptimePercent ?? null, // null if no events yet
      totalEventsProcessed: totalEvents.count || 0,
      errorRatePercent: errorRate,
      recentActivityCount: recentActivity.count || 0,
      dataQualityScore: dataQualityScore ?? null, // null if no events yet
      // Note: system.error events will show 0 until error tracking is added
    };

    // Get last refresh timestamp from analytics_refresh_state
    const { data: refreshState } = await supabase
      .from('analytics_refresh_state')
      .select('last_refresh')
      .eq('id', 'single')
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        leadership: leadershipKPIs,
        sales: salesKPIs,
        internalReliability: internalReliabilityKPIs,
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
    console.error('[metrics/kpis] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

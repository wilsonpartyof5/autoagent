/**
 * Phase 4: Analytics & Performance Page
 * 
 * Displays analytics metrics including leads, searches, and conversions.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveDealership } from '@/lib/supabase/dealerships';
import { createClient } from '@/lib/supabase/server';

interface DailyMetric {
  date: string;
  lead_count: number;
  unique_sessions: number;
  unique_vehicles: number;
  unique_vins: number;
}

interface WeeklyMetric {
  week_start: string;
  total_events: number;
  unique_sessions: number;
  search_sessions: number;
  vehicles_viewed: number;
  leads_submitted: number;
  vehicles_with_leads: number;
}

interface MonthlyMetric {
  month_start: string;
  total_events: number;
  unique_sessions: number;
  search_sessions: number;
  vehicles_viewed: number;
  leads_submitted: number;
  vehicles_with_leads: number;
}

async function fetchDailyMetrics(dealerId: string, days: number = 7): Promise<DailyMetric[]> {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/daily?days=${days}&dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    
    if (!response.ok) {
      console.error('Failed to fetch daily metrics:', response.status);
      return [];
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch daily metrics:', error);
    return [];
  }
}

async function fetchLeadsMetrics(dealerId: string) {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/leads?dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    
    if (!response.ok) {
      console.error('Failed to fetch leads metrics:', response.status);
      return {
        totalLeads: 0,
        leadsToday: 0,
        leadsThisWeek: 0,
        leadsThisMonth: 0,
      };
    }
    
    const result = await response.json();
    return {
      totalLeads: result.data?.totalLeads || 0,
      leadsToday: result.data?.leadsToday || 0,
      leadsThisWeek: result.data?.leadsThisWeek || 0,
      leadsThisMonth: result.data?.leadsThisMonth || 0,
    };
  } catch (error) {
    console.error('Failed to fetch leads metrics:', error);
    return {
      totalLeads: 0,
      leadsToday: 0,
      leadsThisWeek: 0,
      leadsThisMonth: 0,
    };
  }
}

async function fetchSearchMetrics(dealerId: string) {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/search?dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    
    if (!response.ok) {
      console.error('Failed to fetch search metrics:', response.status);
      return {
        totalSearches: 0,
        searchesToday: 0,
        searchesThisWeek: 0,
        searchesThisMonth: 0,
        topFilters: [],
        averageResultsPerSearch: 0,
      };
    }
    
    const result = await response.json();
    return {
      totalSearches: result.data?.totalSearches || 0,
      searchesToday: result.data?.searchesToday || 0,
      searchesThisWeek: result.data?.searchesThisWeek || 0,
      searchesThisMonth: result.data?.searchesThisMonth || 0,
      topFilters: result.data?.topFilters || [],
      averageResultsPerSearch: result.data?.averageResultsPerSearch || 0,
    };
  } catch (error) {
    console.error('Failed to fetch search metrics:', error);
    return {
      totalSearches: 0,
      searchesToday: 0,
      searchesThisWeek: 0,
      searchesThisMonth: 0,
      topFilters: [],
      averageResultsPerSearch: 0,
    };
  }
}

async function fetchConversionMetrics(dealerId: string) {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/conversions?dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    
    if (!response.ok) {
      console.error('Failed to fetch conversion metrics:', response.status);
      return {
        conversionRate: 0,
        totalSearches: 0,
        totalConversions: 0,
        averageHoursToConvert: 0,
      };
    }
    
    const result = await response.json();
    return {
      conversionRate: result.data?.conversionRate || 0,
      totalSearches: result.data?.totalSearches || 0,
      totalConversions: result.data?.totalConversions || 0,
      averageHoursToConvert: result.data?.averageHoursToConvert || 0,
    };
  } catch (error) {
    console.error('Failed to fetch conversion metrics:', error);
    return {
      conversionRate: 0,
      totalSearches: 0,
      totalConversions: 0,
      averageHoursToConvert: 0,
    };
  }
}

async function fetchKPIMetrics(dealerId: string) {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/kpis?days=30&dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    if (!response.ok) {
      return {
        leadership: {},
        sales: {},
        internalReliability: {},
      };
    }
    const data = await response.json();
    return data.data || {
      leadership: {},
      sales: {},
      internalReliability: {},
    };
  } catch (error) {
    console.error('Failed to fetch KPI metrics:', error);
    return {
      leadership: {},
      sales: {},
      internalReliability: {},
    };
  }
}

async function fetchWeeklyMetrics(dealerId: string, weeks: number = 4): Promise<WeeklyMetric[]> {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/weekly?weeks=${weeks}&dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    
    if (!response.ok) {
      console.error('Failed to fetch weekly metrics:', response.status);
      return [];
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch weekly metrics:', error);
    return [];
  }
}

async function fetchMonthlyMetrics(dealerId: string, months: number = 6): Promise<MonthlyMetric[]> {
  try {
    // Use API endpoint with relative URL to include cookies/auth
    const response = await fetch(`/api/metrics/monthly?months=${months}&dealer_id=${dealerId}`, {
      cache: 'no-store',
      credentials: 'include', // Include cookies for auth
    });
    
    if (!response.ok) {
      console.error('Failed to fetch monthly metrics:', response.status);
      return [];
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch monthly metrics:', error);
    return [];
  }
}

export default async function AnalyticsPage() {
  const activeDealership = await getActiveDealership();
  
  if (!activeDealership?.marketcheckDealerId) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Analytics &amp; Performance</h1>
          <p className="text-sm text-muted-foreground">
            Track lead performance and ROI. Monitor search trends and conversion rates.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">No active dealership</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please set up a dealership first in Settings to view analytics.
          </p>
        </div>
      </section>
    );
  }

  const dealerId = activeDealership.marketcheckDealerId;

  // Fetch all metrics in parallel
  const [dailyMetrics, leadsMetrics, searchMetrics, conversionMetrics, kpiMetrics, weeklyMetrics, monthlyMetrics] = await Promise.all([
    fetchDailyMetrics(dealerId),
    fetchLeadsMetrics(dealerId),
    fetchSearchMetrics(dealerId),
    fetchConversionMetrics(dealerId),
    fetchKPIMetrics(dealerId),
    fetchWeeklyMetrics(dealerId, 4),
    fetchMonthlyMetrics(dealerId, 6),
  ]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Analytics &amp; Performance</h1>
        <p className="text-sm text-muted-foreground">
          Track lead performance and ROI. Monitor search trends and conversion rates.
          <span className="block mt-1">
            Showing analytics for <strong>{activeDealership.name}</strong>
          </span>
        </p>
      </header>

      {/* Leads Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Leads</CardDescription>
            <CardTitle className="text-3xl">{leadsMetrics.totalLeads}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Leads Today</CardDescription>
            <CardTitle className="text-3xl">{leadsMetrics.leadsToday}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Leads This Week</CardDescription>
            <CardTitle className="text-3xl">{leadsMetrics.leadsThisWeek}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Leads This Month</CardDescription>
            <CardTitle className="text-3xl">{leadsMetrics.leadsThisMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Searches</CardDescription>
            <CardTitle className="text-3xl">{searchMetrics.totalSearches}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Searches Today</CardDescription>
            <CardTitle className="text-3xl">{searchMetrics.searchesToday}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Searches This Week</CardDescription>
            <CardTitle className="text-3xl">{searchMetrics.searchesThisWeek}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Results/Search</CardDescription>
            <CardTitle className="text-3xl">{searchMetrics.averageResultsPerSearch}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Average vehicles per search</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Conversion Rate</CardDescription>
            <CardTitle className="text-4xl">
              {conversionMetrics.conversionRate.toFixed(2)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {conversionMetrics.totalConversions} conversions from{' '}
              {conversionMetrics.totalSearches} searches
            </p>
            {conversionMetrics.averageHoursToConvert > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Average time to convert: {conversionMetrics.averageHoursToConvert.toFixed(1)} hours
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Search Activity</CardDescription>
            <CardTitle className="text-4xl">{searchMetrics.searchesThisMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Searches in the last 30 days
            </p>
            {searchMetrics.topFilters.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Top Filters:</p>
                <div className="flex flex-wrap gap-2">
                  {searchMetrics.topFilters.slice(0, 5).map((filter: { filter: string; count: number }, index: number) => (
                    <span
                      key={index}
                      className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
                    >
                      {filter.filter.replace('make:', '').replace('model:', '')} ({filter.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leadership KPIs */}
      {kpiMetrics.leadership && Object.keys(kpiMetrics.leadership).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Leadership KPIs</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Leads</CardDescription>
                <CardTitle className="text-2xl">{(kpiMetrics.leadership as { totalLeads?: number })?.totalLeads ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Leads Growth</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.leadership as { leadsGrowthPercent?: number })?.leadsGrowthPercent ?? 0).toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">30-day growth</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Vehicles w/ Leads</CardDescription>
                <CardTitle className="text-2xl">
                  {(kpiMetrics.leadership as { uniqueVehiclesWithLeads?: number })?.uniqueVehiclesWithLeads ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Unique vehicles</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Conversion Rate</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.leadership as { conversionRate?: number })?.conversionRate ?? 0).toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Search to lead</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Market Share</CardDescription>
                <CardTitle className="text-2xl">
                  {(kpiMetrics.leadership as { marketShare?: number })?.marketShare ?? 0}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Industry comparison</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Sales KPIs */}
      {kpiMetrics.sales && Object.keys(kpiMetrics.sales).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Sales KPIs</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Conversion Rate</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.sales as { searchToLeadConversionRate?: number })?.searchToLeadConversionRate ?? 0).toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Search to lead</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Avg Time to Convert</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.sales as { averageTimeToConvertHours?: number })?.averageTimeToConvertHours ?? 0).toFixed(1)}h
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Searches</CardDescription>
                <CardTitle className="text-2xl">
                  {(kpiMetrics.sales as { totalSearches?: number })?.totalSearches ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Lead Quality</CardDescription>
                <CardTitle className="text-2xl">
                  {(kpiMetrics.sales as { leadQualityScore?: number })?.leadQualityScore ?? 0}/100
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Quality score</p>
              </CardContent>
            </Card>
          </div>
          {(kpiMetrics.sales as { topPerformingVehicles?: Array<{ vehicleId: string; leadCount: number }> })?.topPerformingVehicles && 
           (kpiMetrics.sales as { topPerformingVehicles: Array<{ vehicleId: string; leadCount: number }> }).topPerformingVehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Vehicles</CardTitle>
                <CardDescription>Vehicles with most leads in last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(kpiMetrics.sales as { topPerformingVehicles: Array<{ vehicleId: string; leadCount: number; vin?: string }> }).topPerformingVehicles.map((vehicle, index) => (
                    <div key={vehicle.vehicleId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">#{index + 1} {vehicle.vin || vehicle.vehicleId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">{vehicle.leadCount}</p>
                        <p className="text-xs text-muted-foreground">leads</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Internal Reliability KPIs */}
      {kpiMetrics.internalReliability && Object.keys(kpiMetrics.internalReliability).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Internal Reliability KPIs</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>System Uptime</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.internalReliability as { systemUptimePercent?: number })?.systemUptimePercent ?? 100).toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Availability</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Events Processed</CardDescription>
                <CardTitle className="text-2xl">
                  {(kpiMetrics.internalReliability as { totalEventsProcessed?: number })?.totalEventsProcessed ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Error Rate</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.internalReliability as { errorRatePercent?: number })?.errorRatePercent ?? 0).toFixed(2)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Error percentage</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Data Quality</CardDescription>
                <CardTitle className="text-2xl">
                  {((kpiMetrics.internalReliability as { dataQualityScore?: number })?.dataQualityScore ?? 100).toFixed(0)}/100
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Quality score</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Daily Trends */}
      {dailyMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Lead Trends</CardTitle>
            <CardDescription>Leads per day over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dailyMetrics.map((metric) => (
                <div
                  key={metric.date}
                  className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(metric.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric.unique_sessions} sessions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      {metric.lead_count}
                    </p>
                    <p className="text-xs text-muted-foreground">leads</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Trends */}
      {weeklyMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Metrics</CardTitle>
            <CardDescription>Aggregated metrics by week over the last 4 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weeklyMetrics.map((metric) => (
                <div
                  key={metric.week_start}
                  className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Week of {new Date(metric.week_start).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric.unique_sessions} sessions • {metric.search_sessions} search sessions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      {metric.leads_submitted}
                    </p>
                    <p className="text-xs text-muted-foreground">leads</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metric.vehicles_viewed} views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trends */}
      {monthlyMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Metrics</CardTitle>
            <CardDescription>Aggregated metrics by month over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monthlyMetrics.map((metric) => (
                <div
                  key={metric.month_start}
                  className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(metric.month_start).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric.unique_sessions} sessions • {metric.search_sessions} search sessions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      {metric.leads_submitted}
                    </p>
                    <p className="text-xs text-muted-foreground">leads</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metric.vehicles_viewed} views • {metric.vehicles_with_leads} with leads
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

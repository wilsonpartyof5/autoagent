/**
 * Brain health check: failure rate monitoring, webhook gaps, vendor incident correlation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getEventStats, getOpenIncidents, type VendorIncident } from './repository';

export type HealthCheckResult = {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'alert';
  metrics: {
    currentPeriodEvents: number;
    currentPeriodFailures: number;
    currentFailureRate: number;
    baselineFailureRate: number;
    failureRateSpike: boolean;
    byVendor: Record<string, { events: number; failures: number; failureRate: number }>;
    byChannel: Record<string, number>;
    unmatchedDeals: number;
  };
  alerts: string[];
  vendorIncidents: VendorIncident[];
  correlations: string[];
};

const BASELINE_DAYS = 7;
const CURRENT_HOURS = 1;
const FAILURE_RATE_SPIKE_THRESHOLD = 2.0;
const UNMATCHED_DEAL_THRESHOLD = 0.1;

export async function runHealthCheck(supabase: SupabaseClient): Promise<HealthCheckResult> {
  const now = new Date();
  const currentStart = new Date(now.getTime() - CURRENT_HOURS * 60 * 60 * 1000).toISOString();
  const baselineStart = new Date(now.getTime() - BASELINE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [currentStats, baselineStats, openIncidents] = await Promise.all([
    getEventStats(supabase, { since: currentStart }),
    getEventStats(supabase, { since: baselineStart, until: currentStart }),
    getOpenIncidents(supabase),
  ]);

  const currentFailureRate = currentStats.total > 0
    ? currentStats.failures / currentStats.total
    : 0;

  const baselineTotal = baselineStats.total > 0 ? baselineStats.total : 1;
  const baselineFailureRate = baselineStats.failures / baselineTotal;

  const failureRateSpike = currentFailureRate > baselineFailureRate * FAILURE_RATE_SPIKE_THRESHOLD
    && currentStats.failures > 2;

  const unmatchedRate = currentStats.total > 0
    ? currentStats.unmatched / currentStats.total
    : 0;

  const alerts: string[] = [];

  if (failureRateSpike) {
    alerts.push(
      `Failure rate spike: ${(currentFailureRate * 100).toFixed(1)}% vs ${(baselineFailureRate * 100).toFixed(1)}% baseline`,
    );
  }

  if (unmatchedRate > UNMATCHED_DEAL_THRESHOLD && currentStats.total > 5) {
    alerts.push(
      `High unmatched deal rate: ${(unmatchedRate * 100).toFixed(1)}% of events have no deal_id`,
    );
  }

  const correlations: string[] = [];
  for (const incident of openIncidents) {
    const vendorFailures = currentStats.byVendor[incident.vendor];
    if (vendorFailures && vendorFailures > 0) {
      correlations.push(
        `${incident.vendor} failures may be related to incident "${incident.title}" (${incident.status})`,
      );
    }
  }

  const byVendor: Record<string, { events: number; failures: number; failureRate: number }> = {};
  for (const [vendor, count] of Object.entries(currentStats.byVendor)) {
    const vendorFailures = await getVendorFailures(supabase, vendor, currentStart);
    byVendor[vendor] = {
      events: count,
      failures: vendorFailures,
      failureRate: count > 0 ? vendorFailures / count : 0,
    };
  }

  const status: HealthCheckResult['status'] =
    alerts.length > 0 ? 'alert'
    : openIncidents.length > 0 ? 'degraded'
    : 'healthy';

  return {
    timestamp: now.toISOString(),
    status,
    metrics: {
      currentPeriodEvents: currentStats.total,
      currentPeriodFailures: currentStats.failures,
      currentFailureRate,
      baselineFailureRate,
      failureRateSpike,
      byVendor,
      byChannel: currentStats.byChannel,
      unmatchedDeals: currentStats.unmatched,
    },
    alerts,
    vendorIncidents: openIncidents,
    correlations,
  };
}

async function getVendorFailures(
  supabase: SupabaseClient,
  vendor: string,
  since: string,
): Promise<number> {
  const { count } = await supabase
    .from('brain_vendor_events')
    .select('*', { count: 'exact', head: true })
    .eq('vendor', vendor)
    .gte('occurred_at', since)
    .not('error_code', 'is', null);

  return count ?? 0;
}

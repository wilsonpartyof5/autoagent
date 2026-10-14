import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { readCronAuth } from '@/lib/shopper/lifecycle';
import { fetchAllVendorStatuses } from '@/lib/brain/vendor-status';
import { upsertVendorIncident, markResolvedIncidents, type VendorIncident } from '@/lib/brain/repository';

/**
 * GET or POST /api/cron/vendor-status
 *
 * Polls Telnyx and ElevenLabs status pages every 5 minutes.
 * Upserts active incidents and marks resolved incidents.
 * Requires Authorization: Bearer $CRON_SECRET.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? process.env.DREVVY_CRON_SECRET;
  const auth = readCronAuth(request.headers.get('authorization'), secret);

  if (auth === 'unconfigured') {
    return new NextResponse(null, { status: 404 });
  }
  if (auth === 'rejected') {
    return NextResponse.json(
      { success: false, error: { code: 'unauthorized', message: 'Unauthorized.' } },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const results = await fetchAllVendorStatuses();

  const upserted: string[] = [];
  const resolved: number[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (!result.success) {
      errors.push(`${result.vendor}: ${result.error}`);
      continue;
    }

    const activeIds: string[] = [];

    for (const incident of result.incidents) {
      activeIds.push(incident.externalId);

      const record: VendorIncident = {
        vendor: result.vendor,
        external_id: incident.externalId,
        title: incident.title,
        status: incident.status,
        impact: incident.impact,
        components: incident.components,
        url: incident.url,
        started_at: incident.startedAt,
        resolved_at: incident.resolvedAt,
        raw: incident.raw,
      };

      const upsertResult = await upsertVendorIncident(supabase, record);
      if ('id' in upsertResult) {
        upserted.push(upsertResult.id);
      } else {
        errors.push(`${result.vendor} upsert: ${upsertResult.error}`);
      }
    }

    const resolvedCount = await markResolvedIncidents(supabase, result.vendor, activeIds);
    resolved.push(resolvedCount);
  }

  return NextResponse.json({
    success: errors.length === 0,
    data: {
      polled: results.map((r) => r.vendor),
      incidentsUpserted: upserted.length,
      incidentsResolved: resolved.reduce((a, b) => a + b, 0),
      statusIndicators: Object.fromEntries(
        results.filter((r) => r.success).map((r) => [r.vendor, r.statusIndicator]),
      ),
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}

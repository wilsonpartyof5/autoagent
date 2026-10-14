import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { readCronAuth } from '@/lib/shopper/lifecycle';
import { runHealthCheck } from '@/lib/brain/health-check';
import { insertBrainRun, updateBrainRun } from '@/lib/brain/repository';
import { BRAIN_CONFIG } from '@/lib/brain/config';

/**
 * GET or POST /api/cron/brain-health
 *
 * Hourly health check: failure rate by vendor/channel vs 7-day baseline,
 * webhook gaps, unmatched deal_ids, open vendor incidents.
 * Correlates failures with incidents. Alerts if thresholds are breached.
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

  const runResult = await insertBrainRun(supabase, {
    job: 'health_check',
    model: 'none',
    prompt_version: BRAIN_CONFIG.promptVersion,
    trigger_ref: null,
    status: 'running',
    input_tokens: null,
    output_tokens: null,
    cost_usd: null,
    tool_calls: [],
    output: null,
    guardrail_hits: null,
    error: null,
    finished_at: null,
  });

  const runId = 'id' in runResult ? runResult.id : null;

  try {
    const result = await runHealthCheck(supabase);

    if (runId) {
      await updateBrainRun(supabase, runId, {
        status: result.status === 'alert' ? 'error' : 'ok',
        output: result,
        finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (runId) {
      await updateBrainRun(supabase, runId, {
        status: 'error',
        error: errorMessage,
        finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'health_check_failed', message: errorMessage } },
      { status: 500 },
    );
  }
}

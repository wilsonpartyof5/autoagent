import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { createAdminClient } from '@/lib/supabase/admin';
import { readCronAuth } from '@/lib/shopper/lifecycle';
import { runDailyDigest } from '@/lib/brain/digest';

/**
 * GET or POST /api/cron/brain-digest
 *
 * Daily analyst digest (7:00 ET): what's working, bottlenecks, objections, proposed lessons.
 * Written to brain_runs.output and displayed in the admin Outreach tab.
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

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json(
      { success: false, error: { code: 'missing_api_key', message: 'OPENAI_API_KEY not configured.' } },
      { status: 500 },
    );
  }

  const supabase = createAdminClient();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const result = await runDailyDigest(supabase, openai);
    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        working: result.working,
        notWorking: result.notWorking,
        bottlenecks: result.bottlenecks,
        objections: result.objections,
        proposedLessons: result.proposedLessons,
        nextSteps: result.nextSteps,
        tokens: result.tokens,
        cost: result.cost,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: { code: 'digest_failed', message: errorMessage } },
      { status: 500 },
    );
  }
}

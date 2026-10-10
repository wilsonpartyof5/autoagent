import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/inventory/usage
 *
 * Returns current and recent MarketCheck API usage so you can monitor
 * free-tier consumption (500 calls/month) before the quota is hit.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "plan": {
 *       "monthlyLimit": 500,
 *       "tier": "free"
 *     },
 *     "currentMonth": {
 *       "month": "2026-04",
 *       "totalCalls": 42,
 *       "searchCalls": 30,
 *       "detailCalls": 12,
 *       "remaining": 458,
 *       "percentUsed": 8.4,
 *       "warningThreshold": false,   // true when >= 80%
 *       "criticalThreshold": false,  // true when >= 95%
 *       "lastCallAt": "2026-04-03T10:00:00.000Z"
 *     },
 *     "recentMonths": [ ... ]
 *   }
 * }
 */

// Adjust when you upgrade plans
const MONTHLY_LIMIT = parseInt(process.env.MARKETCHECK_MONTHLY_LIMIT ?? '500', 10);
const PLAN_TIER = process.env.MARKETCHECK_PLAN_TIER ?? 'free';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  if (!apiKey) return false;
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7) === apiKey) return true;
  return false;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
      { status: 401 },
    );
  }

  try {
    const supabase = createAdminClient();
    const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

    const { data: rows, error } = await supabase
      .from('mc_api_usage_summary')
      .select('*')
      .order('month', { ascending: false })
      .limit(6);

    if (error) {
      console.error(JSON.stringify({ event: 'mc_usage_query_error', error: error.message }));
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Could not fetch usage data' } },
        { status: 500 },
      );
    }

    const currentRow = rows?.find((r) => r.month === currentMonth) ?? null;
    const totalCalls = Number(currentRow?.total_calls ?? 0);
    const searchCalls = Number(currentRow?.search_calls ?? 0);
    const detailCalls = Number(currentRow?.detail_calls ?? 0);
    const remaining = Math.max(MONTHLY_LIMIT - totalCalls, 0);
    const percentUsed = MONTHLY_LIMIT > 0 ? Math.round((totalCalls / MONTHLY_LIMIT) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      data: {
        plan: {
          monthlyLimit: MONTHLY_LIMIT,
          tier: PLAN_TIER,
        },
        currentMonth: {
          month: currentMonth,
          totalCalls,
          searchCalls,
          detailCalls,
          remaining,
          percentUsed,
          warningThreshold: percentUsed >= 80,
          criticalThreshold: percentUsed >= 95,
          lastCallAt: currentRow?.last_call_at ?? null,
        },
        recentMonths: (rows ?? []).map((r) => ({
          month: r.month,
          totalCalls: Number(r.total_calls ?? 0),
          searchCalls: Number(r.search_calls ?? 0),
          detailCalls: Number(r.detail_calls ?? 0),
          lastCallAt: r.last_call_at,
        })),
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'mc_usage_error',
      error: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch usage stats' } },
      { status: 500 },
    );
  }
}

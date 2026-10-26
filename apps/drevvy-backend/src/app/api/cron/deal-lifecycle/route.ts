import { NextRequest, NextResponse } from 'next/server';

import { runLifecycleSchedule, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readCronAuth } from '@/lib/shopper/lifecycle';

/**
 * GET or POST /api/cron/deal-lifecycle
 *
 * Schedule once a day. Sends "Did you buy it?" the day after the expected
 * pickup when no geofence exit was recorded or location was not granted,
 * and marks open deals ended_no_response seven days after the first outreach
 * with no reply, returning the dealer-conversation key. Requires Authorization: Bearer $DREVVY_CRON_SECRET.
 * Responds 404 when that secret is unset. The day-after-pickup prompt sends
 * did_you_buy through FCM. That send is a no-op when Firebase credentials
 * are unset. The geofence prompt stays on the phone.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const auth = readCronAuth(request.headers.get('authorization'), process.env.DREVVY_CRON_SECRET);
  if (auth === 'unconfigured') return new NextResponse(null, { status: 404 });
  if (auth === 'rejected') {
    return NextResponse.json(
      { success: false, error: { code: 'unauthorized', message: 'Unauthorized.' } },
      { status: 401 },
    );
  }
  try {
    const deps = await shopperDeps('schedule');
    const data = await runLifecycleSchedule({
      deals: deps.deals,
      lifecycle: deps.lifecycle,
      now: new Date(),
      notify: deps.notify,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

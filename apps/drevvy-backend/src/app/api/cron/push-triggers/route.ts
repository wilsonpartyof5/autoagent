import { NextRequest, NextResponse } from 'next/server';

import { readRequestJson } from '@/lib/shopper/deal-actions';
import { readCronAuth } from '@/lib/shopper/lifecycle';
import { deliverShopperPushLive } from '@/lib/push/dispatch';
import { pushErrorResponse } from '@/lib/push/http';
import { getPushLedger } from '@/lib/push/ledger';
import { applyPushFact, readPushFact } from '@/lib/push/triggers';

/**
 * POST /api/cron/push-triggers
 *
 * Server-side triggers for a listing price observation and a new offer.
 * A lower price sends price_drop unless the shopper turned that category off
 * (on by default). A new offer amount sends offer_ready. Dealer name, phone,
 * and email on the body are ignored. Requires Authorization: Bearer
 * $DREVVY_CRON_SECRET. Responds 404 when that secret is unset. FCM is a no-op
 * when unset. did_you_buy, car_sold, and official_offer fire from the deal
 * lifecycle, not from this route. The geofence "Did you buy it?" prompt stays
 * on the phone.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = readCronAuth(request.headers.get('authorization'), process.env.DREVVY_CRON_SECRET);
  if (auth === 'unconfigured') return new NextResponse(null, { status: 404 });
  if (auth === 'rejected') {
    return NextResponse.json(
      { success: false, error: { code: 'unauthorized', message: 'Unauthorized.' } },
      { status: 401 },
    );
  }
  try {
    const fact = readPushFact(await readRequestJson(request), new Date().toISOString());
    const data = await applyPushFact(fact, {
      ledger: getPushLedger(),
      deliver: (push) => deliverShopperPushLive(push),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return pushErrorResponse(error);
  }
}

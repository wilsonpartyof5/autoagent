import { NextRequest, NextResponse } from 'next/server';

import { stubDealerConversationRefundJob } from '@/lib/shopper/key-spend';
import { readCronAuth } from '@/lib/shopper/lifecycle';

/**
 * STUB GET or POST /api/cron/dealer-conversation-key-refunds
 *
 * Product: refund the dealer-conversation key 1:1 after Day 7 with no reply
 * (cadence Day 0–7, same clock), or when the listing is sold. Does not refund
 * the market intel + save key. Does not refund on 30-minute cancel.
 *
 * Not wired — consume/refund RPCs cannot target chat vs market. This route
 * returns stub payloads only. Requires Authorization: Bearer $DREVVY_CRON_SECRET.
 * Responds 404 when that secret is unset.
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

  return NextResponse.json({
    success: true,
    data: {
      wired: false,
      jobs: [
        stubDealerConversationRefundJob('no_reply_day_7', 'unwired'),
        stubDealerConversationRefundJob('sold', 'unwired'),
        stubDealerConversationRefundJob('early_removal_no_refund', 'unwired'),
      ],
    },
  });
}

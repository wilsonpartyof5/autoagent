import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DealerMobileApiError,
  dealerMobileErrorResponse,
  requireDealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import { listAuthorizedDealerships } from '@/lib/dealer-mobile/dealerships';
import {
  LEAD_STATUSES,
  findAuthorizedLead,
} from '@/lib/dealer-mobile/leads';

export const runtime = 'nodejs';

const statusRequest = z.object({
  status: z.enum(LEAD_STATUSES),
});

type RouteContext = {
  params: Promise<{ leadId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const { leadId } = await context.params;
    const parsed = statusRequest.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new DealerMobileApiError('Choose a valid lead status.', 400, 'invalid_status');
    }

    const dealerships = await listAuthorizedDealerships(auth);
    await findAuthorizedLead(auth, leadId, dealerships);
    const now = new Date().toISOString();
    const status = parsed.data.status;

    const { error } = await auth.supabase
      .from('leads')
      .update({
        status,
        replied_at: status === 'new' ? null : now,
        closed_at: status === 'closed' ? now : null,
      })
      .eq('id', leadId);

    if (error) {
      console.error('[dealer-mobile] Failed to update lead status:', error);
      throw new DealerMobileApiError(
        'The lead status could not be updated.',
        500,
        'lead_update_failed',
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}

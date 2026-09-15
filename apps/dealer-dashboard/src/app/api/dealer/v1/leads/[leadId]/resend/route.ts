import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DealerMobileApiError,
  dealerMobileErrorResponse,
  requireDealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import { listAuthorizedDealerships } from '@/lib/dealer-mobile/dealerships';
import { findAuthorizedLead } from '@/lib/dealer-mobile/leads';
import { kickLeadDeliveryOutbox } from '@/lib/lead-delivery';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ leadId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const { leadId } = await context.params;
    const dealerships = await listAuthorizedDealerships(auth);
    const { lead, dealership } = await findAuthorizedLead(auth, leadId, dealerships);

    const { error } = await createAdminClient().from('lead_delivery_jobs').insert({
      lead_id: lead.id,
      dealership_id: lead.dealership_id ?? dealership.id,
      dealer_id: lead.dealer_id ?? dealership.marketcheckDealerId,
      status: 'pending',
      idempotency_key: `mobile-resend:${lead.id}:${randomUUID()}`,
    });

    if (error) {
      console.error('[dealer-mobile] Failed to queue lead resend:', error);
      throw new DealerMobileApiError(
        'The XML lead could not be queued for delivery.',
        500,
        'lead_resend_failed',
      );
    }

    kickLeadDeliveryOutbox().catch((kickError) => {
      console.error('[dealer-mobile] Lead delivery kick failed:', kickError);
    });

    return new NextResponse(null, { status: 202 });
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}

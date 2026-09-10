'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveDealership } from '@/lib/supabase/dealerships';
import { kickLeadDeliveryOutbox } from '@/lib/lead-delivery';
import { revalidatePath } from 'next/cache';

async function requireRooftopAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' as const, user: null, dealership: null };
  }

  const dealership = await getActiveDealership();
  if (!dealership) {
    return { error: 'No active dealership' as const, user, dealership: null };
  }

  return { error: null, user, dealership };
}

function leadBelongsToRooftop(
  lead: { dealership_id?: string | null; dealer_id?: string | null },
  dealership: { id: string; marketcheckDealerId: string | null },
): boolean {
  if (lead.dealership_id && lead.dealership_id === dealership.id) return true;
  if (!lead.dealership_id && dealership.marketcheckDealerId && lead.dealer_id === dealership.marketcheckDealerId) {
    return true;
  }
  return false;
}

/**
 * Queue another CRM delivery attempt. The ADF XML is rebuilt from the saved lead.
 */
export async function resendLeadDelivery(leadId: string): Promise<{ success: boolean; error?: string }> {
  const access = await requireRooftopAccess();
  if (access.error || !access.dealership) {
    return { success: false, error: access.error ?? 'Not authenticated' };
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, dealer_id, dealership_id')
    .eq('id', leadId)
    .maybeSingle();

  if (leadError || !lead || !leadBelongsToRooftop(lead, access.dealership)) {
    return { success: false, error: 'Lead not found for this rooftop' };
  }

  const admin = createAdminClient();
  const { error: jobError } = await admin.from('lead_delivery_jobs').insert({
    lead_id: lead.id,
    dealership_id: lead.dealership_id ?? access.dealership.id,
    dealer_id: lead.dealer_id ?? access.dealership.marketcheckDealerId,
    status: 'pending',
    idempotency_key: `resend:${lead.id}:${Date.now()}`,
  });

  if (jobError) {
    return { success: false, error: 'Unable to queue another delivery attempt' };
  }

  kickLeadDeliveryOutbox().catch(() => {});
  revalidatePath('/app/leads');
  return { success: true };
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'test_drive_booked', 'closed'] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!LEAD_STATUSES.includes(status)) {
    return { success: false, error: 'Invalid lead status' };
  }

  const access = await requireRooftopAccess();
  if (access.error || !access.dealership) {
    return { success: false, error: access.error ?? 'Not authenticated' };
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, dealer_id, dealership_id')
    .eq('id', leadId)
    .maybeSingle();

  if (leadError || !lead || !leadBelongsToRooftop(lead, access.dealership)) {
    return { success: false, error: 'Lead not found for this rooftop' };
  }

  const timestamps: { replied_at: string | null; closed_at: string | null } = {
    replied_at: null,
    closed_at: null,
  };

  if (status !== 'new') {
    timestamps.replied_at = new Date().toISOString();
  }
  if (status === 'closed') {
    timestamps.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('leads')
    .update({
      status,
      replied_at: timestamps.replied_at,
      closed_at: timestamps.closed_at,
    })
    .eq('id', leadId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/app/leads');
  return { success: true };
}

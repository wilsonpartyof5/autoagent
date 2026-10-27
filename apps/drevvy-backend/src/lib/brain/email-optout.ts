/**
 * Email opt-out tracking.
 * Records email.unsubscribed and email.spam_reported events against the email address.
 * Check before every email send; when it fires, end the deal and return the shopper's slot.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { endDeal } from '@/lib/shopper/lifecycle';
import { getLifecycleRepository } from '@/lib/shopper/lifecycle-store';
import { supabaseShopperDealRepository } from '@/lib/shopper/deal-store';
import { refundCredit } from '@/lib/shopper/credits';

export type EmailOptoutReason = 'unsubscribed' | 'spam_reported';

export type EmailOptout = {
  id: string;
  email: string;
  reason: EmailOptoutReason;
  vendorEventId: string | null;
  createdAt: string;
};

export async function recordEmailOptout(
  supabase: SupabaseClient,
  email: string,
  reason: EmailOptoutReason,
  vendorEventId?: string,
): Promise<{ id: string } | { error: string }> {
  const normalized = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from('email_optouts')
    .upsert(
      {
        email: normalized,
        reason,
        vendor_event_id: vendorEventId ?? null,
      },
      { onConflict: 'email' },
    )
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('email_optouts')
        .select('id')
        .eq('email', normalized)
        .single();
      if (existing) return { id: existing.id };
    }
    return { error: error.message };
  }

  return { id: data.id };
}

export async function isEmailOptedOut(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const normalized = email.toLowerCase().trim();

  const { data } = await supabase
    .from('email_optouts')
    .select('id')
    .eq('email', normalized)
    .limit(1)
    .single();

  return !!data;
}

export type EmailSendCheckResult =
  | { canSend: true }
  | { canSend: false; reason: 'opted_out'; email: string; optout: EmailOptout };

export async function checkEmailBeforeSend(
  supabase: SupabaseClient,
  recipientEmail: string,
): Promise<EmailSendCheckResult> {
  const optout = await getEmailOptout(supabase, recipientEmail);

  if (optout) {
    console.log(JSON.stringify({
      event: 'email_send_blocked_optout',
      email: recipientEmail,
      reason: optout.reason,
      optedOutAt: optout.createdAt,
    }));

    return {
      canSend: false,
      reason: 'opted_out',
      email: recipientEmail,
      optout,
    };
  }

  return { canSend: true };
}

export async function getEmailOptout(
  supabase: SupabaseClient,
  email: string,
): Promise<EmailOptout | null> {
  const normalized = email.toLowerCase().trim();

  const { data } = await supabase
    .from('email_optouts')
    .select('id, email, reason, vendor_event_id, created_at')
    .eq('email', normalized)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    reason: data.reason as EmailOptoutReason,
    vendorEventId: data.vendor_event_id,
    createdAt: data.created_at,
  };
}

export type EndDealOnOptoutResult = {
  ended: boolean;
  dealId: string;
  previousState: string;
  newState: string;
  reason: string;
  creditRefunded: boolean;
};

export async function endDealOnOptout(
  dealId: string,
  reason: EmailOptoutReason,
  occurredAt: string,
): Promise<EndDealOnOptoutResult> {
  const lifecycle = getLifecycleRepository();
  const deals = supabaseShopperDealRepository();
  const supabase = createAdminClient();

  const record = await lifecycle.getById(dealId);
  if (!record) {
    return {
      ended: false,
      dealId,
      previousState: 'unknown',
      newState: 'unknown',
      reason: 'deal_not_found',
      creditRefunded: false,
    };
  }

  const previousState = record.endState;
  if (previousState !== 'open') {
    return {
      ended: false,
      dealId,
      previousState,
      newState: previousState,
      reason: 'already_ended',
      creditRefunded: false,
    };
  }

  const updated = endDeal(record, 'dealer_declined', occurredAt);
  await lifecycle.save(updated);
  await deals.close(record.consumerUserId, dealId);

  const refundResult = await refundCredit(
    supabase,
    record.consumerUserId,
    dealId,
    'dealer_opted_out',
  );

  console.log(JSON.stringify({
    event: 'deal_ended_email_optout',
    dealId,
    reason,
    previousState,
    newState: updated.endState,
    occurredAt,
    creditRefunded: refundResult.refunded,
    newBalance: refundResult.newBalance,
  }));

  return {
    ended: true,
    dealId,
    previousState,
    newState: updated.endState,
    reason: `email_${reason}`,
    creditRefunded: refundResult.refunded,
  };
}

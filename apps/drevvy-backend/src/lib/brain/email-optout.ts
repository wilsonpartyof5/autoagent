/**
 * Email opt-out tracking.
 * Records email.unsubscribed and email.spam_reported events against the email address.
 * Check before every email send; when it fires, end the deal and return the shopper's slot.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

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

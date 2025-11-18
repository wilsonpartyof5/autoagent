'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Resend a lead delivery by replaying the stored ADF XML
 */
export async function resendLeadDelivery(leadId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Find the most recent successful delivery log for this lead (to get the ADF payload)
    const { data: latestLog, error: logError } = await supabase
      .from('lead_delivery_logs')
      .select('adf_payload, delivery_method, delivery_target, dealer_id')
      .eq('lead_id', leadId)
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logError || !latestLog) {
      return { success: false, error: 'Delivery log not found for this lead' };
    }

    // Get dealer delivery settings to ensure they're still configured
    const { data: profile } = await supabase
      .from('profiles')
      .select('lead_delivery_method, lead_delivery_endpoint, lead_delivery_email')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.lead_delivery_method) {
      return { success: false, error: 'Lead delivery not configured. Please configure it in Settings.' };
    }

    // Verify the delivery method matches
    if (profile.lead_delivery_method !== latestLog.delivery_method) {
      return {
        success: false,
        error: `Delivery method changed from ${latestLog.delivery_method} to ${profile.lead_delivery_method}. Please configure delivery settings.`,
      };
    }

    // Determine target
    const target =
      latestLog.delivery_method === 'http'
        ? profile.lead_delivery_endpoint
        : profile.lead_delivery_email;

    if (!target) {
      return { success: false, error: 'Delivery target not configured' };
    }

    // Attempt delivery
    let deliveryResult: { success: boolean; status?: number; body?: string; error?: string };

    if (latestLog.delivery_method === 'http') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(target, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml, application/json, */*',
          },
          body: latestLog.adf_payload,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseBody = await response.text().catch(() => 'Unable to read response body');
        const truncatedBody = responseBody.length > 1000 ? responseBody.substring(0, 1000) + '...' : responseBody;

        deliveryResult = {
          success: response.ok,
          status: response.status,
          body: truncatedBody,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        deliveryResult = {
          success: false,
          error: errorMsg.includes('aborted') ? 'Request timeout (5s exceeded)' : errorMsg,
        };
      }
    } else {
      // Email delivery not yet implemented
      deliveryResult = {
        success: false,
        error: 'Email delivery not yet implemented',
      };
    }

    // Log the resend attempt
    const { error: insertError } = await supabase.from('lead_delivery_logs').insert({
      lead_id: leadId,
      user_id: user.id,
      dealer_id: latestLog.dealer_id,
      delivery_method: latestLog.delivery_method,
      delivery_target: target,
      status: deliveryResult.success ? 'success' : 'failed',
      http_status: deliveryResult.status || null,
      response_body: deliveryResult.body || null,
      error_message: deliveryResult.error || null,
      adf_payload: latestLog.adf_payload,
      attempted_by: user.id,
      resend_note: 'Manual resend triggered by user',
    });

    if (insertError) {
      console.error('Failed to log resend attempt', insertError);
    }

    revalidatePath('/app/leads');

    if (deliveryResult.success) {
      return { success: true };
    } else {
      return { success: false, error: deliveryResult.error || 'Delivery failed' };
    }
  } catch (error) {
    console.error('Error resending lead delivery', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}


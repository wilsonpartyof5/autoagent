import pino from 'pino';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env.js';
import { deliverLead } from './deliverLead.js';

const logger = (pino as any)();

const BACKOFF_CAP_MS = 30 * 60 * 1000;
const STALE_PROCESSING_MS = 2 * 60 * 1000;

type DeliveryJob = {
  id: string;
  lead_id: string;
  dealership_id: string | null;
  dealer_id: string | null;
  attempts: number;
  max_attempts: number;
};

function getServiceClient(): SupabaseClient {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceRoleKey) {
    throw new Error('Supabase service role is required to process lead delivery jobs');
  }
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function nextBackoffMs(attempts: number): number {
  return Math.min(BACKOFF_CAP_MS, 1000 * 2 ** Math.max(1, attempts));
}

async function reclaimStaleProcessingJobs(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { error } = await supabase
    .from('lead_delivery_jobs')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('updated_at', cutoff);

  if (error) {
    logger.warn({ event: 'lead_delivery_outbox_reclaim_failed', error: error.message });
  }
}

export async function processLeadDeliveryJobs(limit = 10): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceRoleKey) {
    logger.warn({ event: 'lead_delivery_outbox_skipped', reason: 'supabase_not_configured' });
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const supabase = getServiceClient();
  await reclaimStaleProcessingJobs(supabase);
  const now = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from('lead_delivery_jobs')
    .select('id, lead_id, dealership_id, dealer_id, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error({ event: 'lead_delivery_outbox_fetch_failed', error: error.message });
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of (jobs ?? []) as DeliveryJob[]) {
    const { data: claimed } = await supabase
      .from('lead_delivery_jobs')
      .update({
        status: 'processing',
        attempts: job.attempts + 1,
        updated_at: now,
      })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed) continue;
    processed += 1;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, dealer_id, dealership_id, vehicle_id, vin, enc_payload')
      .eq('id', job.lead_id)
      .maybeSingle();

    if (leadError || !lead?.enc_payload) {
      await markJob(supabase, job, false, leadError?.message || 'Lead payload missing', true);
      failed += 1;
      continue;
    }

    try {
      const result = await deliverLead({
        leadId: lead.id,
        dealerId: lead.dealer_id ?? job.dealer_id ?? undefined,
        dealershipId: lead.dealership_id ?? job.dealership_id ?? undefined,
        vehicleId: lead.vehicle_id,
        vin: lead.vin ?? undefined,
        encPayload: lead.enc_payload,
      });

      const terminal =
        !result.success &&
        Boolean(result.error?.toLowerCase().includes('not yet implemented'));

      await markJob(supabase, job, result.success, result.error, terminal);
      if (result.success) succeeded += 1;
      else failed += 1;
    } catch (error) {
      await markJob(
        supabase,
        job,
        false,
        error instanceof Error ? error.message : 'Unknown delivery error',
        false,
      );
      failed += 1;
    }
  }

  return { processed, succeeded, failed };
}

async function markJob(
  supabase: SupabaseClient,
  job: DeliveryJob,
  success: boolean,
  lastError?: string,
  terminalFailure = false,
): Promise<void> {
  const attempts = job.attempts + 1;
  const exhausted = terminalFailure || attempts >= job.max_attempts;
  const status = success ? 'succeeded' : exhausted ? 'failed' : 'pending';

  await supabase
    .from('lead_delivery_jobs')
    .update({
      status,
      last_error: lastError ?? null,
      next_attempt_at: success
        ? new Date().toISOString()
        : new Date(Date.now() + nextBackoffMs(attempts)).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

import pino from 'pino';

const logger = pino();

export interface LeadData {
  leadId: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  createdAt: number;
  encPayload: string;
}

/**
 * Forward lead to dashboard ingest API
 */
export async function forwardLead(leadData: LeadData): Promise<void> {
  const ingestUrl = process.env.DASHBOARD_INGEST_URL;
  const ingestToken = process.env.DASHBOARD_INGEST_TOKEN;

  if (!ingestUrl || !ingestToken) {
    logger.warn('Dashboard ingest not configured - skipping lead forwarding', {
      leadId: leadData.leadId,
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ingestToken}`,
      },
      body: JSON.stringify(leadData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Dashboard ingest failed: ${response.status} ${response.statusText}`);
    }

    logger.info('Lead forwarded to dashboard successfully', {
      leadId: leadData.leadId,
      dealerId: leadData.dealerId,
      vehicleId: leadData.vehicleId,
    });
  } catch (error) {
    logger.error('Failed to forward lead to dashboard', {
      leadId: leadData.leadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Don't throw - this is fire-and-forget
    // The lead is still stored locally even if forwarding fails
  }
}

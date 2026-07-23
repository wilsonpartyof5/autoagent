import pino from 'pino';
import { CONFIG } from '../config/env.js';

const logger = (pino as any)();

export interface LeadData {
  leadId: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  createdAt: number;
  encPayload: string;
  inventorySource?: 'uvs_db' | 'marketcheck_mcp';
  routingStatus?: 'dealer_assigned' | 'platform_inbox';
  flowId?: string;
  externalListingId?: string;
  vehicleSnapshot?: Record<string, unknown>;
}

/**
 * Forward lead to dashboard ingest API
 */
export async function forwardLead(leadData: LeadData): Promise<void> {
  const ingestUrl = CONFIG.dashboardIngestUrl;
  const ingestToken = CONFIG.dashboardIngestToken;

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

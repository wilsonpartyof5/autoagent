import { z } from 'zod';
import { nanoid } from 'nanoid';
import pino from 'pino';
import { encryptJson } from '../lib/crypto.js';
import { insertLead, countRecentLeadsByIp } from '../data/db.js';
import { forwardLead } from '../services/forwardLead.js';
import { deliverLead } from '../services/deliverLead.js';
import { trackEvent } from '../lib/analytics/tracking.js';
import { generateRequestId } from '@autoagent/shared';
import { verifySearchResult } from '../lib/searchResultToken.js';
import { recordFlowEvent } from '../lib/flowTelemetry.js';

const logger = (pino as any)();

// Input schema for submit-lead tool (UVS-first)
// All vehicle data must come from UVS - no provider-specific fields allowed
const SubmitLeadSchema = z.object({
  // Required UVS identifiers
  vehicleId: z.string().min(1, 'vehicleId is required from UVS'),
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i, 'Invalid VIN format'),
  
  // Required UVS dealer information
  dealerId: z.string().min(1).optional(),
  dealerName: z.string().min(1).optional(),
  
  // Required UVS pricing information
  pricing: z.object({
    price: z.number().nonnegative('Price must be non-negative'),
    currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('USD'),
  }),
  
  // User contact information
  user: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    phone: z.string().optional(),
    preferredTime: z.string().optional(),
  }),
  
  // Required consent
  consent: z.boolean().refine(val => val === true, 'Consent must be true'),
  searchResultToken: z.string().min(1).optional(),
}).strict(); // Reject any additional non-UVS fields


export interface SubmitLeadContext {
  // No PII - removed ipAddress and userAgent
}

/**
 * Submit a lead for a vehicle
 */
export async function submitLead(
  params: unknown,
  context?: SubmitLeadContext
): Promise<{
  success: boolean;
  content?: Array<{ type: string; text: string }>;
  structuredContent?: {
    leadId: string;
    vehicleId: string;
    dealerId: string;
    vin: string;
    price: number;
    currency: string;
  };
  error?: string;
}> {
  try {
    // Validate input schema
    const parseResult = SubmitLeadSchema.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid input: ${parseResult.error.errors.map(e => e.message).join(', ')}`,
      };
    }

    const { vehicleId, vin, dealerId, dealerName, pricing, user, consent, searchResultToken } = parseResult.data;

    // ENFORCE UVS lookup - vehicle must exist in uvs_vehicles
    const { getUVSVehicleById, getUVSVehicleByVIN } = await import('../db/uvs-vehicles.js');
    
    // Try by vehicleId first (primary lookup)
    let vehicle = await getUVSVehicleById(vehicleId);
    
    // If not found by ID, try by VIN as fallback
    if (!vehicle) {
      vehicle = await getUVSVehicleByVIN(vin);
    }
    
    let marketcheckSnapshot: ReturnType<typeof verifySearchResult> | null = null;
    if (!vehicle && searchResultToken) {
      try {
        marketcheckSnapshot = verifySearchResult(searchResultToken);
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : 'SEARCH_RESULT_TOKEN_INVALID';
        return { success: false, error: `Unable to validate selected vehicle (${errorCode}). Please refresh the search.` };
      }
    }

    // REJECT if neither UVS nor a signed MarketCheck search result can validate it.
    if (!vehicle && !marketcheckSnapshot) {
      return {
        success: false,
        error: 'Vehicle not found in UVS inventory and no valid MarketCheck search token was provided.',
      };
    }

    if (marketcheckSnapshot) {
      if (
        marketcheckSnapshot.listingId !== vehicleId ||
        marketcheckSnapshot.vin.toUpperCase() !== vin.toUpperCase() ||
        marketcheckSnapshot.dealerId !== dealerId
      ) {
        return { success: false, error: 'Selected vehicle information does not match the signed search result.' };
      }
    }

    // Validate VIN matches UVS record
    const uvsVin = vehicle?.baseIdentity?.vin ?? marketcheckSnapshot?.vin;
    if (!uvsVin) {
      return {
        success: false,
        error: 'Vehicle in UVS does not have a VIN. Cannot submit lead.',
      };
    }
    
    if (uvsVin.toUpperCase() !== vin.toUpperCase()) {
      return {
        success: false,
        error: `VIN mismatch: provided VIN "${vin}" does not match UVS VIN "${uvsVin}"`,
      };
    }

    // Validate vehicleId matches UVS record
    if (vehicle && vehicle.id !== vehicleId) {
      return {
        success: false,
        error: `Vehicle ID mismatch: provided vehicleId "${vehicleId}" does not match UVS vehicle ID "${vehicle.id}"`,
      };
    }

    // Derive dealer information from UVS (source of truth)
    const uvsDealerId = vehicle?.location?.dealer?.dealerId ?? marketcheckSnapshot?.dealerId;
    const uvsDealerName = vehicle?.location?.dealer?.name ?? marketcheckSnapshot?.dealerName;
    
    // Validate dealerId matches UVS
    if (uvsDealerId && uvsDealerId !== dealerId) {
      return {
        success: false,
        error: `Dealer ID mismatch: provided dealerId "${dealerId}" does not match UVS dealerId "${uvsDealerId}"`,
      };
    }
    
    // Validate dealerName matches UVS
    if (uvsDealerName && uvsDealerName !== dealerName) {
      return {
        success: false,
        error: `Dealer name mismatch: provided dealerName "${dealerName}" does not match UVS dealerName "${uvsDealerName}"`,
      };
    }
    
    // Use UVS dealer info if not provided (hydration)
    const resolvedDealerId = dealerId || uvsDealerId;
    const resolvedDealerName = dealerName || uvsDealerName;
    
    if (!resolvedDealerId) {
      return {
        success: false,
        error: 'Dealer ID is required. Vehicle in UVS does not have a dealerId.',
      };
    }
    
    if (!resolvedDealerName) {
      return {
        success: false,
        error: 'Dealer name is required. Vehicle in UVS does not have a dealer name.',
      };
    }

    // Derive pricing from UVS (source of truth)
    const uvsPrice = vehicle?.pricing?.price ?? marketcheckSnapshot?.price;
    const uvsCurrency = vehicle?.pricing?.currency ?? marketcheckSnapshot?.currency ?? 'USD';
    
    // Validate pricing matches UVS
    if (uvsPrice !== undefined && Math.abs(uvsPrice - pricing.price) > 0.01) {
      logger.warn('Price mismatch between input and UVS', {
        inputPrice: pricing.price,
        uvsPrice,
        vehicleId,
      });
      // Use UVS price as source of truth
    }
    
    // Use UVS pricing (source of truth)
    const resolvedPrice = uvsPrice !== undefined ? uvsPrice : pricing.price;
    const resolvedCurrency = uvsCurrency || pricing.currency || 'USD';
    const inventorySource = marketcheckSnapshot ? 'marketcheck_mcp' : 'uvs_db';
    const routingStatus = marketcheckSnapshot ? 'platform_inbox' : 'dealer_assigned';
    const flowId = marketcheckSnapshot?.flowId ?? generateRequestId();

    // Generate lead ID
    const leadId = nanoid();

    // Encrypt the payload (user contact info only - no vehicle/dealer data)
    const payload = {
      user,
      // Vehicle/dealer data stored separately in DB, not in encrypted payload
    };

    const encPayload = await encryptJson(payload);
    
    // Store in database with UVS IDs and pricing snapshot
    const createdAt = Date.now();
    insertLead({
      id: leadId,
      uvsVehicleId: vehicleId, // FK to uvs_vehicles.id
      uvsDealerId: resolvedDealerId, // FK to uvs_vehicles.dealer_id
      vehicleId, // Keep for backward compatibility
      dealerId: resolvedDealerId, // Keep for backward compatibility
      vin: uvsVin,
      price: resolvedPrice,
      currency: resolvedCurrency,
      encPayload,
      consent,
      createdAt,
    });

    // Forward to dashboard (fire-and-forget)
    forwardLead({
      leadId,
      dealerId: resolvedDealerId,
      vehicleId,
      vin: uvsVin,
      createdAt,
      encPayload,
      inventorySource,
      routingStatus,
      flowId,
      externalListingId: marketcheckSnapshot?.listingId,
      vehicleSnapshot: marketcheckSnapshot?.vehicle,
    }).catch(error => {
      logger.error('Failed to forward lead', { leadId, error: error.message });
    });

    // Deliver to dealer's CRM via ADF XML (fire-and-forget)
    if (resolvedDealerId && !marketcheckSnapshot) {
      deliverLead({
        leadId,
        dealerId: resolvedDealerId,
        vehicleId,
        vin: uvsVin,
        encPayload,
      }).catch(error => {
        logger.error('Failed to deliver lead to CRM', { leadId, dealerId: resolvedDealerId, error: error.message });
      });
    }

    // Log lead creation (non-PII)
    logger.info('Lead created (UVS-first)', {
      event: 'lead_created',
      leadId,
      vehicleId,
      uvsVehicleId: vehicleId,
      dealerId: resolvedDealerId,
      uvsDealerId: resolvedDealerId,
      vin: uvsVin,
      price: resolvedPrice,
      currency: resolvedCurrency,
      inventorySource,
      routingStatus,
      flowId,
      ts: createdAt,
    });

    // Track lead submission event (PII-safe: only IDs, no user data)
    const requestId = generateRequestId(); // Used as request-level correlation
    trackEvent('lead.submit', {
      leadId,
      vehicleId,
      vin: uvsVin,
      // No PII in payload - only IDs
    }, {
      dealerId: resolvedDealerId, // Required for lead.submit
      vehicleId, // Required for lead.submit
      vin: uvsVin,
      requestId,
      sessionId: flowId,
    }).catch(() => {
      // Tracking failures should not break the request
    });
    recordFlowEvent({
      flowId,
      eventName: 'lead.submitted',
      source: 'mcp-server',
      provider: inventorySource,
      requestId,
      toolName: 'submit-lead',
      dealerId: resolvedDealerId,
      vehicleId,
      vin: uvsVin,
      status: routingStatus,
      payload: { leadId },
    }).catch(() => {});

    return {
      success: true,
      content: [
        {
          type: 'text',
          text: 'Lead submitted successfully. We\'ll confirm with the dealer.',
        },
      ],
      structuredContent: {
        leadId,
        vehicleId,
        dealerId: resolvedDealerId,
        vin: uvsVin,
        price: resolvedPrice,
        currency: resolvedCurrency,
      },
    };
  } catch (error) {
    logger.error('Error submitting lead', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

import { z } from 'zod';
import { nanoid } from 'nanoid';
import pino from 'pino';
import { encryptJson } from '../lib/crypto';
import { insertLead, countRecentLeadsByIp } from '../data/db';
import { forwardLead } from '../services/forwardLead';
import { deliverLead } from '../services/deliverLead';
import { trackEvent } from '../lib/analytics/tracking';
import { generateRequestId } from '@autoagent/shared';

const logger = pino();

// Input schema for submit-lead tool (UVS-first)
// All vehicle data must come from UVS - no provider-specific fields allowed
const SubmitLeadSchema = z.object({
  // Required UVS identifiers
  vehicleId: z.string().min(1, 'vehicleId is required from UVS'),
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i, 'Invalid VIN format'),
  
  // Required UVS dealer information
  dealerId: z.string().min(1, 'dealerId is required from UVS'),
  dealerName: z.string().min(1, 'dealerName is required from UVS'),
  
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

    const { vehicleId, vin, dealerId, dealerName, pricing, user, consent } = parseResult.data;

    // ENFORCE UVS lookup - vehicle must exist in uvs_vehicles
    const { getUVSVehicleById, getUVSVehicleByVIN } = await import('../db/uvs-vehicles');
    
    // Try by vehicleId first (primary lookup)
    let vehicle = await getUVSVehicleById(vehicleId);
    
    // If not found by ID, try by VIN as fallback
    if (!vehicle) {
      vehicle = await getUVSVehicleByVIN(vin);
    }
    
    // REJECT if UVS lookup fails
    if (!vehicle) {
      return {
        success: false,
        error: 'Vehicle not found in UVS inventory. Please verify the vehicle ID or VIN.',
      };
    }

    // Validate VIN matches UVS record
    const uvsVin = vehicle.baseIdentity?.vin;
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
    if (vehicle.id !== vehicleId) {
      return {
        success: false,
        error: `Vehicle ID mismatch: provided vehicleId "${vehicleId}" does not match UVS vehicle ID "${vehicle.id}"`,
      };
    }

    // Derive dealer information from UVS (source of truth)
    const uvsDealerId = vehicle.location?.dealer?.dealerId;
    const uvsDealerName = vehicle.location?.dealer?.name;
    
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
    const uvsPrice = vehicle.pricing?.price;
    const uvsCurrency = vehicle.pricing?.currency || 'USD';
    
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
    }).catch(error => {
      logger.error('Failed to forward lead', { leadId, error: error.message });
    });

    // Deliver to dealer's CRM via ADF XML (fire-and-forget)
    if (resolvedDealerId) {
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
      ts: createdAt,
    });

    // Track lead submission event (PII-safe: only IDs, no user data)
    const requestId = generateRequestId(); // Used as sessionId for request correlation
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
      sessionId: requestId, // Use requestId as sessionId for request-level correlation
    }).catch(() => {
      // Tracking failures should not break the request
    });

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

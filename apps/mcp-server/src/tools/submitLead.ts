import { z } from 'zod';
import { nanoid } from 'nanoid';
import pino from 'pino';
import { encryptJson } from '../lib/crypto.js';
import { insertLead, countRecentLeadsByIp } from '../data/db.js';
import { forwardLead } from '../services/forwardLead.js';

const logger = pino();

// Input schema for submit-lead tool
const SubmitLeadSchema = z.object({
  vehicleId: z.string().min(1),
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i, 'Invalid VIN format'),
  dealerId: z.string().optional(),
  user: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    phone: z.string().optional(),
    preferredTime: z.string().optional(),
  }),
  consent: z.boolean().refine(val => val === true, 'Consent must be true'),
});


export interface SubmitLeadContext {
  ipAddress?: string;
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
    dealerId?: string;
    vin: string;
  };
  error?: string;
}> {
  try {
    // Validate input
    const parseResult = SubmitLeadSchema.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid input: ${parseResult.error.errors.map(e => e.message).join(', ')}`,
      };
    }

    const { vehicleId, vin, dealerId, user, consent } = parseResult.data;

    // Rate limiting: max 5 leads per IP per 24 hours
    if (context?.ipAddress) {
      const recentLeads = countRecentLeadsByIp(context.ipAddress, 24 * 60 * 60 * 1000);
      if (recentLeads >= 5) {
        return {
          success: false,
          error: 'Rate limit exceeded. Maximum 5 leads per IP per 24 hours.',
        };
      }
    }

    // Generate lead ID
    const leadId = nanoid();

    // Encrypt the payload
    const payload = {
      user,
      vehicleId,
      dealerId,
      vin,
    };

    const encPayload = await encryptJson(payload);

    // Store in database
    const createdAt = Date.now();
    insertLead({
      id: leadId,
      dealerId,
      vehicleId,
      vin,
      encPayload,
      consent,
      createdAt,
      ipAddress: context?.ipAddress,
    });

    // Forward to dashboard (fire-and-forget)
    forwardLead({
      leadId,
      dealerId,
      vehicleId,
      vin,
      createdAt,
      encPayload,
    }).catch(error => {
      logger.error('Failed to forward lead', { leadId, error: error.message });
    });

    // Log lead creation (non-PII)
    logger.info('Lead created', {
      event: 'lead_created',
      leadId,
      vehicleId,
      dealerId,
      vin,
      ts: createdAt,
    });

    return {
      success: true,
      content: [
        {
          type: 'text',
          text: 'Lead submitted. We\'ll confirm with the dealer.',
        },
      ],
      structuredContent: {
        leadId,
        vehicleId,
        dealerId,
        vin,
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

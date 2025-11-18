/**
 * Lead Delivery Service
 * Delivers leads to dealer's configured CRM endpoint (HTTP or Email) using ADF XML format
 */

import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import { generateAdfXml, type LeadData } from './adf-generator.js';
import { decryptToJson } from '../lib/crypto.js';

const logger = pino();

interface DealerDeliverySettings {
  method: 'http' | 'email' | null;
  endpoint: string | null;
  email: string | null;
}

interface VehicleInfo {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  stockNumber?: string;
  price?: number;
  miles?: number;
  condition?: string;
  dealerName?: string;
  dealerCity?: string;
  dealerState?: string;
  dealerZip?: string;
  dealerPhone?: string;
}

interface DeliveryLog {
  leadId: string;
  userId?: string;
  dealerId?: string;
  method: 'http' | 'email';
  target: string;
  status: 'success' | 'failed';
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  adfPayload: string;
}

/**
 * Get Supabase client with service role key (for server-side operations)
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set');
  }

  // Use service role key if available, otherwise use anon key (limited functionality)
  const supabaseKey = supabaseServiceKey || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error('Supabase key (SERVICE_ROLE_KEY or ANON_KEY) must be set');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch dealer delivery settings from Supabase
 */
async function getDealerDeliverySettings(dealerId: string): Promise<DealerDeliverySettings | null> {
  try {
    const supabase = getSupabaseClient();

    // Find user_id by dealer_id (assuming dealer_id is stored in profiles)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, lead_delivery_method, lead_delivery_endpoint, lead_delivery_email')
      .eq('marketcheck_dealer_id', dealerId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch dealer delivery settings', { dealerId, error: error.message });
      return null;
    }

    if (!profile) {
      logger.warn('Dealer profile not found', { dealerId });
      return null;
    }

    return {
      method: (profile.lead_delivery_method as 'http' | 'email' | null) || null,
      endpoint: profile.lead_delivery_endpoint || null,
      email: profile.lead_delivery_email || null,
    };
  } catch (error) {
    logger.error('Error fetching dealer delivery settings', {
      dealerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Fetch vehicle information from Supabase inventory
 */
async function getVehicleInfo(vehicleId: string, vin?: string): Promise<VehicleInfo | null> {
  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('inventory_vehicles')
      .select('vin, year, make, model, trim, stock_number, price, miles, condition, dealer_name, dealer_city, dealer_state, dealer_zip, dealer_phone, dealer_id')
      .limit(1);

    if (vin) {
      query = query.eq('vin', vin);
    } else {
      query = query.eq('id', vehicleId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error('Failed to fetch vehicle info', { vehicleId, vin, error: error.message });
      return null;
    }

    if (!data) {
      logger.warn('Vehicle not found in inventory', { vehicleId, vin });
      return null;
    }

    return {
      vin: data.vin || undefined,
      year: data.year || undefined,
      make: data.make || undefined,
      model: data.model || undefined,
      trim: data.trim || undefined,
      stockNumber: data.stock_number || undefined,
      price: data.price ? Number(data.price) : undefined,
      miles: data.miles ? Number(data.miles) : undefined,
      condition: data.condition || undefined,
      dealerName: data.dealer_name || undefined,
      dealerCity: data.dealer_city || undefined,
      dealerState: data.dealer_state || undefined,
      dealerZip: data.dealer_zip || undefined,
      dealerPhone: data.dealer_phone || undefined,
    };
  } catch (error) {
    logger.error('Error fetching vehicle info', {
      vehicleId,
      vin,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Deliver ADF XML via HTTP POST
 */
async function deliverViaHttp(endpoint: string, adfXml: string): Promise<{ success: boolean; status?: number; body?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml, application/json, */*',
      },
      body: adfXml,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => 'Unable to read response body');
    const truncatedBody = responseBody.length > 1000 ? responseBody.substring(0, 1000) + '...' : responseBody;

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        body: truncatedBody,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      status: response.status,
      body: truncatedBody,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMsg.includes('aborted') ? 'Request timeout (5s exceeded)' : errorMsg,
    };
  }
}

/**
 * Deliver ADF XML via Email
 * Note: Email implementation pending - logs for now
 */
async function deliverViaEmail(email: string, adfXml: string, leadId: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement email delivery
  // For now, log that email delivery is needed
  logger.warn('Email delivery not yet implemented', {
    email,
    leadId,
    note: 'ADF XML payload generated but email sending needs to be implemented',
  });

  return {
    success: false,
    error: 'Email delivery not yet implemented',
  };
}

/**
 * Log delivery attempt to Supabase
 */
async function logDeliveryAttempt(log: DeliveryLog): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('lead_delivery_logs').insert({
      lead_id: log.leadId,
      user_id: log.userId || null,
      dealer_id: log.dealerId || null,
      delivery_method: log.method,
      delivery_target: log.target,
      status: log.status,
      http_status: log.httpStatus || null,
      response_body: log.responseBody || null,
      error_message: log.errorMessage || null,
      adf_payload: log.adfPayload,
      attempted_by: 'system',
    });

    if (error) {
      logger.error('Failed to log delivery attempt', { leadId: log.leadId, error: error.message });
    }
  } catch (error) {
    logger.error('Error logging delivery attempt', {
      leadId: log.leadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Main delivery function - orchestrates the entire lead delivery process
 */
export async function deliverLead({
  leadId,
  dealerId,
  vehicleId,
  vin,
  encPayload,
  userId,
}: {
  leadId: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  userId?: string;
}): Promise<void> {
  if (!dealerId) {
    logger.warn('No dealer ID provided, skipping lead delivery', { leadId });
    return;
  }

  try {
    // Fetch dealer delivery settings
    const settings = await getDealerDeliverySettings(dealerId);
    if (!settings || !settings.method) {
      logger.info('Dealer has no delivery method configured', { dealerId, leadId });
      return;
    }

    // Decrypt lead payload
    const payload = (await decryptToJson(encPayload)) as {
      user: { name: string; email: string; phone?: string; preferredTime?: string };
      vehicleId: string;
      dealerId?: string;
      vin?: string;
    };

    // Fetch vehicle information
    const vehicleInfo = await getVehicleInfo(vehicleId, vin || payload.vin);

    // Build lead data for ADF generation
    const leadData: LeadData = {
      leadId,
      user: payload.user,
      vehicle: {
        vin: vehicleInfo?.vin || payload.vin,
        year: vehicleInfo?.year,
        make: vehicleInfo?.make,
        model: vehicleInfo?.model,
        trim: vehicleInfo?.trim,
        stockNumber: vehicleInfo?.stockNumber,
        price: vehicleInfo?.price,
        miles: vehicleInfo?.miles,
        condition: vehicleInfo?.condition,
      },
      dealer: {
        id: dealerId,
        name: vehicleInfo?.dealerName,
        city: vehicleInfo?.dealerCity,
        state: vehicleInfo?.dealerState,
        zip: vehicleInfo?.dealerZip,
        phone: vehicleInfo?.dealerPhone,
      },
      source: 'AutoAgent',
      timestamp: new Date().toISOString(),
    };

    // Generate ADF XML
    const adfXml = generateAdfXml(leadData);

    // Deliver based on method
    let deliveryResult: { success: boolean; status?: number; body?: string; error?: string };

    if (settings.method === 'http' && settings.endpoint) {
      deliveryResult = await deliverViaHttp(settings.endpoint, adfXml);
    } else if (settings.method === 'email' && settings.email) {
      const emailResult = await deliverViaEmail(settings.email, adfXml, leadId);
      deliveryResult = emailResult;
    } else {
      logger.error('Invalid delivery configuration', { dealerId, settings, leadId });
      return;
    }

    // Log delivery attempt
    await logDeliveryAttempt({
      leadId,
      userId,
      dealerId,
      method: settings.method,
      target: settings.method === 'http' ? settings.endpoint! : settings.email!,
      status: deliveryResult.success ? 'success' : 'failed',
      httpStatus: deliveryResult.status,
      responseBody: deliveryResult.body,
      errorMessage: deliveryResult.error,
      adfPayload: adfXml,
    });

    if (deliveryResult.success) {
      logger.info('Lead delivered successfully', {
        leadId,
        dealerId,
        method: settings.method,
        target: settings.method === 'http' ? settings.endpoint : settings.email,
      });
    } else {
      logger.error('Lead delivery failed', {
        leadId,
        dealerId,
        method: settings.method,
        error: deliveryResult.error,
      });
    }
  } catch (error) {
    logger.error('Error delivering lead', {
      leadId,
      dealerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Log failed attempt
    try {
      const adfXml = `<?xml version="1.0"?><adf><error>Failed to generate ADF XML</error></adf>`;
      await logDeliveryAttempt({
        leadId,
        userId,
        dealerId,
        method: 'http', // Default, actual method unknown due to error
        target: 'unknown',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        adfPayload: adfXml,
      });
    } catch (logError) {
      logger.error('Failed to log delivery error', { leadId, error: logError });
    }
  }
}


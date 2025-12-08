/**
 * Phase 4: Event Tracking Utility for MCP Server
 * 
 * Handles tracking analytics events to Supabase.
 * No PII collected - IP addresses and user agents removed.
 */

import type { EventName, EventPayload } from '@autoagent/shared';
import { generateEventId } from '@autoagent/shared';
import { prepareEventForInsert } from '@autoagent/shared';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../../config/env.js';
import pino from 'pino';

const logger = (pino as any)({ name: 'analytics' });

/**
 * Get Supabase client for analytics
 */
function getSupabaseClient() {
  const supabaseUrl = CONFIG.supabaseUrl;
  const supabaseServiceKey = CONFIG.supabaseServiceRoleKey;
  const supabaseAnonKey = CONFIG.supabaseAnonKey;

  if (!supabaseUrl) {
    logger.warn('Supabase URL not configured - analytics events will not be tracked');
    return null;
  }

  // Use service role key if available, otherwise use anon key
  const supabaseKey = supabaseServiceKey || supabaseAnonKey;

  if (!supabaseKey) {
    logger.warn('Supabase key not configured - analytics events will not be tracked');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Track an analytics event from the MCP server
 * 
 * This function writes events to the analytics_events table.
 * It never throws - failures are logged but don't break requests.
 * 
 * Sessions for MCP are request-level (using requestId as sessionId for correlation).
 * 
 * @param eventName - The type of event being tracked
 * @param payload - Event-specific payload data (no PII, validated against allowlist)
 * @param options - Additional tracking options (NO PII)
 */
export async function trackEvent<T extends EventName>(
  eventName: T,
  payload: EventPayload,
  options?: {
    dealerId?: string;
    vehicleId?: string;
    vin?: string;
    sessionId?: string; // Request-level session correlation (use requestId)
    requestId?: string;
    userId?: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Supabase not configured - skip tracking silently
      return;
    }

    // For MCP, use requestId as sessionId for request-level correlation
    // This allows correlating events within a single request
    const sessionId = options?.sessionId || options?.requestId || null;
    
    // Use unified validation from shared core
    const validation = prepareEventForInsert(eventName, payload, {
      dealerId: options?.dealerId,
      vehicleId: options?.vehicleId,
      vin: options?.vin,
      sessionId,
    });

    // ENFORCE: Block insert if validation fails
    if (!validation.valid) {
      logger.warn('Event validation failed - insert BLOCKED', {
        eventName,
        errors: validation.errors,
        requiredIdsValid: validation.requiredIdsValid,
      });
      // Return early - database constraints will also block, but prevent unnecessary DB calls
      return;
    }

    const sanitizedPayload = validation.sanitizedPayload || {};

    // Generate event ID
    const eventId = generateEventId();

    // Ensure session exists if provided (database constraints require session_id for most events)
    if (sessionId) {
      const { error: sessionError } = await supabase
        .from('analytics_sessions')
        .upsert(
          {
            id: sessionId, // Reused requestId for request-level correlation
            user_id: options?.userId || null,
            dealer_id: options?.dealerId || null,
            started_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        );
      if (sessionError) {
        logger.error('Failed to create/update session', sessionError);
        // If session creation fails and session_id is required, abort insert
        if (validation.errors?.some(e => e.includes('session_id'))) {
          logger.error('Session creation failed and session_id required - aborting insert');
          return;
        }
      }
    }

    // Prepare event data
    const eventData: {
      id: string;
      session_id: string | null;
      event_name: string;
      source: string; // Required: 'mcp-server'
      dealer_id: string | null;
      vehicle_id: string | null;
      vin: string | null;
      user_id: string | null;
      payload: unknown;
      request_id: string | null;
      timestamp: string;
    } = {
      id: eventId,
      session_id: sessionId || null,
      event_name: eventName,
      source: 'mcp-server', // Always mcp-server for MCP tool events
      dealer_id: options?.dealerId || null,
      vehicle_id: options?.vehicleId || null,
      vin: options?.vin || null,
      user_id: options?.userId || null,
      payload: sanitizedPayload || {},
      request_id: options?.requestId || null,
      timestamp: new Date().toISOString(),
    };

    // Insert event
    const { error } = await supabase
      .from('analytics_events')
      .insert(eventData);

    if (error) {
      logger.error('Failed to track event', {
        eventName,
        error: error.message,
        eventId,
      });
    } else {
      logger.debug('Event tracked', { eventName, eventId, source: 'mcp-server' });
    }
  } catch (error) {
    // Never throw - just log the error
    logger.error('Error tracking event', {
      eventName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Track system error event
 */
export async function trackSystemError(
  errorType: string,
  errorMessage: string,
  component: string,
  options?: {
    dealerId?: string;
    requestId?: string;
  }
): Promise<void> {
  await trackEvent('system.error', {
    errorType,
    errorMessage: errorMessage.substring(0, 500), // Limit length
    component,
  }, {
    dealerId: options?.dealerId,
    requestId: options?.requestId,
  });
}

/**
 * Create or update a session (no PII)
 */
export async function trackSession(options: {
  sessionId: string;
  dealerId?: string;
  userId?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    // Upsert session (no IP/user_agent per PII policy)
    const { error } = await supabase
      .from('analytics_sessions')
      .upsert(
        {
          id: options.sessionId,
          user_id: options.userId || null,
          dealer_id: options.dealerId || null,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      );

    if (error) {
      logger.error('Failed to track session', {
        sessionId: options.sessionId,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error('Error tracking session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

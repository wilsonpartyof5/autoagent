/**
 * Phase 4: Server-Side Event Tracking Utility
 * 
 * Server-side tracking that accepts session ID from client or generates temporary one.
 * Session IDs should come from client-side session manager for proper persistence.
 */

import type { EventName, EventPayload } from '@autoagent/shared';
import { generateEventId } from '@autoagent/shared';
import { prepareEventForInsert } from '@autoagent/shared';
import { createClient } from '../supabase/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'aa_session_id';

/**
 * Track an analytics event (server-side)
 * 
 * Session ID should come from middleware-set cookie for proper persistence.
 * The middleware ensures analytics session cookie exists and persists across requests.
 * 
 * @param eventName - The type of event being tracked
 * @param payload - Event-specific payload data (validated against allowlist)
 * @param options - Tracking options including sessionId from client
 */
export async function trackEvent<T extends EventName>(
  eventName: T,
  payload: EventPayload,
  options?: {
    sessionId?: string; // Should come from client-side session manager
    dealerId?: string;
    vehicleId?: string;
    vin?: string;
    requestId?: string;
  }
): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Get current user (may be null for anonymous events)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Get session ID from cookie (set by middleware) - REUSED across requests
    // IMPORTANT: Cookie value persists for 30 minutes, allowing session-based analytics
    const cookieStore = await cookies();
    const sessionIdFromCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionId = options?.sessionId || sessionIdFromCookie || null;

    // Use unified validation from shared core
    const validation = prepareEventForInsert(eventName, payload, {
      dealerId: options?.dealerId,
      vehicleId: options?.vehicleId,
      vin: options?.vin,
      sessionId,
    });

    // ENFORCE: Block insert if validation fails
    if (!validation.valid) {
      console.warn('[analytics] ENFORCEMENT: Event validation failed - insert BLOCKED', {
        eventName,
        errors: validation.errors,
        requiredIdsValid: validation.requiredIdsValid,
      });
      // Return early - database constraints will also block, but we prevent unnecessary DB calls
      return;
    }

    const sanitizedPayload = validation.sanitizedPayload || {};

    // Generate event ID
    const eventId = generateEventId();

    // ENSURE session exists and persists (session ID reused from cookie)
    // Database constraints require session_id for most events, so we must ensure it exists
    if (sessionId) {
      // Check if session already exists to avoid unnecessary upserts
      const { data: existingSession } = await supabase
        .from('analytics_sessions')
        .select('id')
        .eq('id', sessionId)
        .maybeSingle();

      if (existingSession) {
        // Session exists - just update last_activity_at (reusing existing session)
        const { error: updateError } = await supabase
          .from('analytics_sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', sessionId);
        if (updateError) {
          console.error('[analytics] Failed to update session', updateError);
        }
      } else {
        // Session doesn't exist - create it (first event for this session)
        const { error: createError } = await supabase
          .from('analytics_sessions')
          .insert({
            id: sessionId, // Reused from cookie - persists across requests
            user_id: user?.id || null,
            dealer_id: options?.dealerId || null,
            started_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          });
        if (createError) {
          console.error('[analytics] Failed to create session', createError);
          // If session creation fails and session_id is required, abort insert
          const { validateRequiredIds } = await import('@autoagent/shared');
          const idCheck = validateRequiredIds(eventName, {
            sessionId,
            dealerId: options?.dealerId,
            vehicleId: options?.vehicleId,
            vin: options?.vin,
          });
          if (idCheck.errors.some(e => e.includes('session_id'))) {
            console.error('[analytics] Session creation failed and session_id required - aborting insert');
            return;
          }
        }
      }
    }

    // Prepare event data (database constraints will enforce required IDs)
    const eventData: {
      id: string;
      session_id: string | null;
      event_name: string;
      source: string;
      dealer_id: string | null;
      vehicle_id: string | null;
      vin: string | null;
      user_id: string | null;
      payload: unknown;
      request_id: string | null;
      timestamp: string;
    } = {
      id: eventId,
      session_id: sessionId, // Validated above - will be non-null for events that require it
      event_name: eventName,
      source: 'dashboard',
      dealer_id: options?.dealerId || null,
      vehicle_id: options?.vehicleId || null,
      vin: options?.vin || null,
      user_id: user?.id || null,
      payload: sanitizedPayload || {},
      request_id: options?.requestId || null,
      timestamp: new Date().toISOString(),
    };

    // Insert event (database constraints will reject if required IDs missing)
    const { error } = await supabase
      .from('analytics_events')
      .insert(eventData);

    if (error) {
      // Database constraint violations indicate missing required IDs
      if (error.code === '23514' || error.message.includes('check constraint')) {
        console.error('[analytics] Database constraint violation - required IDs missing', {
          eventName,
          error: error.message,
          eventId,
          dealerId: options?.dealerId,
          vehicleId: options?.vehicleId,
          sessionId,
        });
      } else {
        console.error('[analytics] Failed to track event', {
          eventName,
          error: error.message,
          eventId,
        });
      }
    }
  } catch (error) {
    // Never throw - just log the error
    console.error('[analytics] Error tracking event', {
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
    sessionId?: string;
  }
): Promise<void> {
  await trackEvent('system.error', {
    errorType,
    errorMessage: errorMessage.substring(0, 500),
    component,
  }, {
    dealerId: options?.dealerId,
    requestId: options?.requestId,
    sessionId: options?.sessionId,
  });
}


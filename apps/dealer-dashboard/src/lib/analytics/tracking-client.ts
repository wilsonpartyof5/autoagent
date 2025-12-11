/**
 * Phase 4: Client-Side Event Tracking Utility
 * 
 * Client-side tracking that uses localStorage for session persistence.
 * Makes API calls to server-side tracking endpoint.
 */

'use client';

import type { EventName, EventPayload } from '@autoagent/shared';
import { getOrCreateSessionId } from './session-client';

/**
 * Track an analytics event (client-side)
 * 
 * Uses localStorage-based session management for proper session persistence.
 * 
 * @param eventName - The type of event being tracked
 * @param payload - Event-specific payload data
 * @param options - Tracking options
 */
export async function trackEvent<T extends EventName>(
  eventName: T,
  payload: EventPayload,
  options?: {
    dealerId?: string;
    vehicleId?: string;
    vin?: string;
    requestId?: string;
  }
): Promise<void> {
  try {
    // Get persistent session ID from localStorage
    const sessionId = getOrCreateSessionId();

    // Call server-side tracking API with session ID
    const response = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventName,
        payload,
        sessionId,
        dealerId: options?.dealerId,
        vehicleId: options?.vehicleId,
        vin: options?.vin,
        requestId: options?.requestId,
      }),
    });

    if (!response.ok) {
      console.error('[analytics] Failed to track event', {
        eventName,
        status: response.status,
      });
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
 * Track system error event (client-side)
 * System errors don't require dealer_id or session_id per spec, but we include session_id if available
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
  // System errors don't require IDs, but we can include session_id if available
  const sessionId = getOrCreateSessionId();
  
  await trackEvent('system.error', {
    errorType,
    errorMessage: errorMessage.substring(0, 500),
    component,
  }, {
    ...options,
    // Note: system.error events don't require session_id/dealer_id per unified core,
    // but we include session_id for correlation if available
  });
}


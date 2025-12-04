/**
 * Phase 4: Core Analytics Tracking Logic
 * 
 * Shared tracking logic used by MCP server, dashboard, and widget.
 * Provides unified validation, required ID enforcement, and payload sanitization.
 */

import type { EventName, EventPayload } from './analytics';
import { validateEventPayload, sanitizeEventPayload } from './analytics-validators';

/**
 * Required IDs per event type (unified across all sources)
 */
export const REQUIRED_IDS: Record<EventName, {
  dealerId?: boolean;
  vehicleId?: boolean;
  vin?: boolean;
  sessionId?: boolean;
}> = {
  'inventory.search': { dealerId: false, sessionId: false }, // Optional for anonymous searches
  'inventory.filter': { dealerId: false, sessionId: false },
  'inventory.sort': { dealerId: false, sessionId: false },
  'vehicle.view': { dealerId: true, vehicleId: true, vin: false, sessionId: true },
  'vehicle.click': { dealerId: true, vehicleId: true, vin: false, sessionId: true },
  'vehicle.compare': { dealerId: true, vehicleId: false, vin: false, sessionId: true }, // vehicleIds in payload, not vehicleId
  'lead.submit': { dealerId: true, vehicleId: true, vin: false, sessionId: true },
  'lead.view': { dealerId: true, sessionId: true },
  'dashboard.login': { dealerId: false, sessionId: true },
  'dashboard.inventory.status_change': { dealerId: true, vehicleId: true, vin: false, sessionId: true },
  'dashboard.inventory.edit': { dealerId: true, vehicleId: true, vin: false, sessionId: true },
  'dashboard.inventory.delete': { dealerId: true, vehicleId: true, vin: false, sessionId: true },
  'dashboard.settings.update': { dealerId: true, sessionId: true },
  'system.error': { dealerId: false, sessionId: false }, // System events don't require IDs
  'system.performance': { dealerId: false, sessionId: false },
};

/**
 * Validate required IDs per event type (unified validation)
 */
export function validateRequiredIds(
  eventName: EventName,
  options: { 
    dealerId?: string | null; 
    vehicleId?: string | null; 
    vin?: string | null;
    sessionId?: string | null;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requirements = REQUIRED_IDS[eventName] || {};

  if (requirements.dealerId && (!options.dealerId || options.dealerId === null)) {
    errors.push(`Event "${eventName}" requires dealer_id`);
  }
  if (requirements.vehicleId && (!options.vehicleId || options.vehicleId === null)) {
    errors.push(`Event "${eventName}" requires vehicle_id`);
  }
  if (requirements.vin && !options.vin && !options.vehicleId) {
    errors.push(`Event "${eventName}" requires vin when vehicle_id is not provided`);
  }
  if (requirements.sessionId && (!options.sessionId || options.sessionId === null)) {
    errors.push(`Event "${eventName}" requires session_id`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Core tracking validation and sanitization (shared logic)
 */
export function prepareEventForInsert(
  eventName: EventName,
  payload: EventPayload,
  options: {
    dealerId?: string | null;
    vehicleId?: string | null;
    vin?: string | null;
    sessionId?: string | null;
  }
): { 
  valid: boolean; 
  errors: string[]; 
  sanitizedPayload?: EventPayload;
  requiredIdsValid?: boolean;
} {
  // Validate required IDs
  const idValidation = validateRequiredIds(eventName, options);
  
  // Validate and sanitize payload
  const payloadValidation = validateEventPayload(eventName, payload);
  const sanitizedPayload = sanitizeEventPayload(eventName, payload);

  const allErrors = [
    ...idValidation.errors,
    ...(payloadValidation.valid ? [] : payloadValidation.errors),
  ];

  return {
    valid: idValidation.valid && payloadValidation.valid,
    errors: allErrors,
    sanitizedPayload,
    requiredIdsValid: idValidation.valid,
  };
}


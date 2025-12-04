/**
 * Phase 4: Analytics Event Payload Validators
 * 
 * Strict allowlist-based validation per event type.
 * No PII fields allowed.
 */

import type { EventName, EventPayload } from './analytics.js';

/**
 * Allowed fields per event type (strict allowlist - no PII)
 */
const ALLOWED_FIELDS: Record<EventName, Set<string>> = {
  'inventory.search': new Set(['make', 'model', 'year', 'condition', 'priceMin', 'priceMax', 'location', 'resultsCount', 'searchDuration']),
  'inventory.filter': new Set(['filterType', 'filterValue']),
  'inventory.sort': new Set(['sortBy', 'sortOrder']),
  'vehicle.view': new Set(['vehicleId', 'vin', 'year', 'make', 'model', 'price', 'source']),
  'vehicle.click': new Set(['vehicleId', 'vin', 'clickTarget']),
  'vehicle.compare': new Set(['vehicleIds', 'vins', 'compareCount']),
  'lead.submit': new Set(['vehicleId', 'vin', 'leadId']),
  'lead.view': new Set(['leadId', 'status']),
  'dashboard.login': new Set([]),
  'dashboard.inventory.status_change': new Set(['vehicleId', 'vin', 'oldStatus', 'newStatus']),
  'dashboard.inventory.edit': new Set(['vehicleId', 'vin', 'fieldsChanged']),
  'dashboard.inventory.delete': new Set(['vehicleId', 'vin']),
  'dashboard.settings.update': new Set(['settingsCategory', 'fieldsChanged']),
  'system.error': new Set(['errorType', 'errorMessage', 'component']),
  'system.performance': new Set(['component', 'duration', 'metrics']),
};

/**
 * Validate payload against allowed fields for event type
 */
export function validateEventPayload(eventName: EventName, payload: EventPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedFields = ALLOWED_FIELDS[eventName] || new Set();
  
  if (typeof payload !== 'object' || payload === null) {
    errors.push('Payload must be an object');
    return { valid: false, errors };
  }

  // Check for disallowed fields
  const payloadObj = payload as Record<string, unknown>;
  for (const key of Object.keys(payloadObj)) {
    if (!allowedFields.has(key)) {
      errors.push(`Field "${key}" is not allowed for event "${eventName}"`);
    }
  }

  // Check for PII patterns in values (additional safety)
  const payloadStr = JSON.stringify(payload);
  const piiPatterns = [
    /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email pattern
    /\d{3}[-.]?\d{3}[-.]?\d{4}/, // Phone pattern
  ];
  
  for (const pattern of piiPatterns) {
    if (pattern.test(payloadStr)) {
      errors.push('Payload contains potential PII (email/phone pattern detected)');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize payload by removing disallowed fields and PII
 */
export function sanitizeEventPayload(eventName: EventName, payload: EventPayload): EventPayload {
  const allowedFields = ALLOWED_FIELDS[eventName] || new Set();
  const payloadObj = payload as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Only include allowed fields
  for (const [key, value] of Object.entries(payloadObj)) {
    if (allowedFields.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized as EventPayload;
}


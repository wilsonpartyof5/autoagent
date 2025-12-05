/**
 * Phase 4: Analytics and Event Tracking Types
 * 
 * Defines typed event names and payload structures for analytics tracking.
 * All events must not contain PII (email, phone, etc.)
 */

/**
 * Event Name Union Type
 * All possible event names that can be tracked
 */
export type EventName =
  // Inventory events
  | 'inventory.search'
  | 'inventory.filter'
  | 'inventory.sort'
  
  // Vehicle events
  | 'vehicle.view'
  | 'vehicle.click'
  | 'vehicle.compare'
  
  // Lead events
  | 'lead.submit'
  | 'lead.view'
  
  // Dashboard events
  | 'dashboard.login'
  | 'dashboard.inventory.status_change'
  | 'dashboard.inventory.edit'
  | 'dashboard.inventory.delete'
  | 'dashboard.settings.update'
  
  // System events
  | 'system.error'
  | 'system.performance';

/**
 * Base event payload structure
 */
export interface BaseEventPayload {
  [key: string]: unknown;
}

/**
 * Inventory Search Event Payload
 */
export interface InventorySearchPayload extends BaseEventPayload {
  make?: string;
  model?: string;
  year?: number;
  condition?: 'new' | 'used' | 'certified';
  priceMin?: number;
  priceMax?: number;
  location?: string;
  resultsCount?: number;
  searchDuration?: number; // milliseconds
}

/**
 * Vehicle View Event Payload
 */
export interface VehicleViewPayload extends BaseEventPayload {
  vehicleId: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  price?: number;
  source?: string; // e.g., 'search_results', 'recommendations', 'direct_link'
}

/**
 * Vehicle Click Event Payload
 */
export interface VehicleClickPayload extends BaseEventPayload {
  vehicleId: string;
  vin?: string;
  clickTarget?: string; // e.g., 'image', 'title', 'price', 'button'
}

/**
 * Vehicle Compare Event Payload
 */
export interface VehicleComparePayload extends BaseEventPayload {
  vehicleIds: string[]; // Array of vehicle IDs being compared
  vins?: string[]; // Array of VINs (when available)
  compareCount?: number; // Number of vehicles being compared
}

/**
 * Lead Submit Event Payload
 */
export interface LeadSubmitPayload extends BaseEventPayload {
  vehicleId: string;
  vin?: string;
  leadId: string;
  // Note: NO PII (no email, phone, name, etc.)
}

/**
 * Lead View Event Payload
 */
export interface LeadViewPayload extends BaseEventPayload {
  leadId: string;
  status?: string;
}

/**
 * Dashboard Login Event Payload
 */
export interface DashboardLoginPayload extends BaseEventPayload {
  // No PII - user_id is tracked separately
}

/**
 * Dashboard Inventory Status Change Event Payload
 */
export interface DashboardInventoryStatusChangePayload extends BaseEventPayload {
  vehicleId: string;
  vin?: string;
  oldStatus?: string;
  newStatus: string;
}

/**
 * Dashboard Inventory Edit Event Payload
 */
export interface DashboardInventoryEditPayload extends BaseEventPayload {
  vehicleId: string;
  vin?: string;
  fieldsChanged?: string[]; // e.g., ['price', 'mileage', 'description']
}

/**
 * Dashboard Inventory Delete Event Payload
 */
export interface DashboardInventoryDeletePayload extends BaseEventPayload {
  vehicleId: string;
  vin?: string;
}

/**
 * Dashboard Settings Update Event Payload
 */
export interface DashboardSettingsUpdatePayload extends BaseEventPayload {
  settingsCategory?: string; // e.g., 'lead_delivery', 'inventory_sync'
  fieldsChanged?: string[];
}

/**
 * Discriminated Union of all Event Payloads
 */
export type EventPayload =
  | InventorySearchPayload
  | VehicleViewPayload
  | VehicleClickPayload
  | VehicleComparePayload
  | LeadSubmitPayload
  | LeadViewPayload
  | DashboardLoginPayload
  | DashboardInventoryStatusChangePayload
  | DashboardInventoryEditPayload
  | DashboardInventoryDeletePayload
  | DashboardSettingsUpdatePayload
  | BaseEventPayload;

/**
 * Analytics Event Structure
 */
export interface AnalyticsEvent {
  id: string;
  sessionId?: string;
  eventName: EventName;
  dealerId?: string;
  vehicleId?: string;
  vin?: string;
  userId?: string;
  payload: EventPayload;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * Session Information
 */
export interface SessionInfo {
  id: string;
  userId?: string;
  dealerId?: string;
  ipAddress?: string;
  userAgent?: string;
  startedAt: Date;
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  // Use nanoid-like approach: timestamp + random string
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `sess_${timestamp}_${random}`;
}

/**
 * Generate a request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `req_${timestamp}_${random}`;
}

/**
 * Generate an event ID
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `evt_${timestamp}_${random}`;
}


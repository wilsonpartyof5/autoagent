/**
 * Phase 4: Event Tracking Utility for Dealer Dashboard (Server-Side)
 * 
 * NOTE: For proper session persistence, use the client-side tracking
 * (tracking-client.ts) which uses localStorage, or provide sessionId
 * from client via the /api/analytics/track endpoint.
 * 
 * This server-side utility accepts sessionId as an option.
 * If not provided, session will be null (breaks session analytics).
 */

import type { EventName, EventPayload } from '@autoagent/shared';
import { trackEvent as trackEventImpl } from './tracking-server';

/**
 * Track an analytics event (server-side)
 * 
 * Re-exports from tracking-server for backward compatibility.
 * For proper session persistence, sessionId should come from client.
 */
export { trackEvent } from './tracking-server';

/**
 * Track system error event
 */
export { trackSystemError } from './tracking-server';

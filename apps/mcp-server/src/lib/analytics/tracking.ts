import type { EventName, EventPayload } from '@autoagent/shared';
import { generateRequestId, prepareEventForInsert } from '@autoagent/shared';
import { CONFIG } from '../../config/env.js';
import { recordFlowEvent } from '../flowTelemetry.js';

type TrackingOptions = {
  dealerId?: string;
  vehicleId?: string;
  vin?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
};

/**
 * Compatibility adapter for existing analytics call sites.
 * Events now use the production app_sessions/app_events store rather than the
 * retired analytics_sessions/analytics_events tables.
 */
export async function trackEvent<T extends EventName>(
  eventName: T,
  payload: EventPayload,
  options?: TrackingOptions,
): Promise<void> {
  const flowId = options?.sessionId || options?.requestId || generateRequestId();
  const validation = prepareEventForInsert(eventName, payload, {
    dealerId: options?.dealerId,
    vehicleId: options?.vehicleId,
    vin: options?.vin,
    sessionId: flowId,
  });
  if (!validation.valid) {
    console.warn(
      JSON.stringify({
        event: 'analytics_validation_rejected',
        flowId,
        eventName,
        errors: validation.errors,
      }),
    );
    return;
  }

  await recordFlowEvent({
    flowId,
    eventName,
    source: 'mcp-server',
    provider: CONFIG.inventorySearchProvider,
    requestId: options?.requestId,
    dealerId: options?.dealerId,
    vehicleId: options?.vehicleId,
    vin: options?.vin,
    status: 'recorded',
    payload: (validation.sanitizedPayload ?? {}) as Record<string, unknown>,
  });
}

export async function trackSystemError(
  errorType: string,
  errorMessage: string,
  component: string,
  options?: { dealerId?: string; requestId?: string },
): Promise<void> {
  await trackEvent(
    'system.error',
    {
      errorType,
      errorMessage: errorMessage.substring(0, 500),
      component,
    },
    {
      dealerId: options?.dealerId,
      requestId: options?.requestId,
      sessionId: options?.requestId,
    },
  );
}

export async function trackSession(options: {
  sessionId: string;
  dealerId?: string;
  userId?: string;
}): Promise<void> {
  await recordFlowEvent({
    flowId: options.sessionId,
    eventName: 'session.started',
    source: 'mcp-server',
    provider: CONFIG.inventorySearchProvider,
    dealerId: options.dealerId,
    status: 'recorded',
  });
}

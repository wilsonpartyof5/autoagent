/**
 * Phase 4: Widget Tracking Endpoint
 * 
 * Receives tracking events from the widget (vehicle.view, vehicle.click)
 * Validates using unified validation core before forwarding to tracking.
 */

import express, { type Router } from 'express';
import type { EventName, EventPayload } from '@autoagent/shared';
import { prepareEventForInsert } from '@autoagent/shared';
import { recordFlowEvent } from '../lib/flowTelemetry.js';

const router: Router = express.Router();

router.post('/widget/track', async (req, res) => {
  try {
    const { eventName, payload, sessionId, flowId, dealerId, vehicleId, vin, requestId } = req.body as {
      eventName: string;
      payload: EventPayload;
      sessionId?: string;
      flowId?: string;
      dealerId?: string;
      vehicleId?: string;
      vin?: string;
      requestId?: string;
    };

    // Validate event using unified validation core
    const validation = prepareEventForInsert(eventName as EventName, payload, {
      sessionId,
      dealerId,
      vehicleId,
      vin,
    });

    const resolvedFlowId = flowId || sessionId;
    if (!resolvedFlowId) {
      return res.status(400).json({ success: false, error: 'flowId is required' });
    }

    await recordFlowEvent({
      flowId: resolvedFlowId,
      eventName,
      source: 'widget',
      provider: 'marketcheck_mcp',
      requestId,
      dealerId,
      vehicleId,
      vin,
      status: validation.valid ? 'accepted' : 'accepted_untyped',
      payload: {
        year: (payload as Record<string, unknown>)?.year,
        make: (payload as Record<string, unknown>)?.make,
        model: (payload as Record<string, unknown>)?.model,
        price: (payload as Record<string, unknown>)?.price,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[widget-tracking] Error', error);
    // Return success even on error - tracking failures shouldn't break widget
    res.status(200).json({ success: false });
  }
});

export default router;


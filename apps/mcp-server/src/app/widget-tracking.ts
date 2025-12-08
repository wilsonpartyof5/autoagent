/**
 * Phase 4: Widget Tracking Endpoint
 * 
 * Receives tracking events from the widget (vehicle.view, vehicle.click)
 * Validates using unified validation core before forwarding to tracking.
 */

import express, { type Router } from 'express';
import type { EventName, EventPayload } from '@autoagent/shared';
import { prepareEventForInsert } from '@autoagent/shared';

const router: Router = express.Router();

router.post('/widget/track', async (req, res) => {
  try {
    const { eventName, payload, sessionId, dealerId, vehicleId, vin, requestId } = req.body as {
      eventName: EventName;
      payload: EventPayload;
      sessionId?: string;
      dealerId?: string;
      vehicleId?: string;
      vin?: string;
      requestId?: string;
    };

    // Validate event using unified validation core
    const validation = prepareEventForInsert(eventName, payload, {
      sessionId,
      dealerId,
      vehicleId,
      vin,
    });

    // ENFORCE: Block if validation fails
    if (!validation.valid) {
      console.warn('[widget-tracking] Event validation failed - blocking insert', {
        eventName,
        errors: validation.errors,
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    // Import tracking dynamically to avoid circular deps
    const { trackEvent } = await import('../lib/analytics/tracking.js');

    await trackEvent(
      eventName,
      validation.sanitizedPayload || payload,
      {
        sessionId, // Widget provides its own sessionId (from localStorage)
        dealerId,
        vehicleId,
        vin,
        requestId,
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[widget-tracking] Error', error);
    // Return success even on error - tracking failures shouldn't break widget
    res.status(200).json({ success: false });
  }
});

export default router;


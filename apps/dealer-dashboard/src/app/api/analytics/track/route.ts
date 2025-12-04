/**
 * Phase 4: Analytics Tracking API Endpoint
 * 
 * Server-side endpoint that receives tracking requests from client
 * with persistent session IDs from localStorage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackEvent as trackEventServer } from '@/lib/analytics/tracking-server';
import type { EventName, EventPayload } from '@autoagent/shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      eventName: EventName;
      payload: EventPayload;
      sessionId: string; // From client-side localStorage
      dealerId?: string;
      vehicleId?: string;
      vin?: string;
      requestId?: string;
    };

    // Track event with session ID from client
    await trackEventServer(
      body.eventName,
      body.payload,
      {
        sessionId: body.sessionId, // Use client-provided session ID
        dealerId: body.dealerId,
        vehicleId: body.vehicleId,
        vin: body.vin,
        requestId: body.requestId,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/analytics/track] Error', error);
    // Return success even on error - tracking failures shouldn't break requests
    return NextResponse.json({ success: false }, { status: 500 });
  }
}


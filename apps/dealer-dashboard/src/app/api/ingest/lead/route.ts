import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify authorization header
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.DASHBOARD_INGEST_TOKEN;
    
    if (!expectedToken) {
      return NextResponse.json({ error: 'Dashboard ingest not configured' }, { status: 500 });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    const {
      leadId,
      dealerId,
      vehicleId,
      vin,
      createdAt,
      encPayload,
      inventorySource,
      routingStatus,
      flowId,
      externalListingId,
      vehicleSnapshot,
    } = body;
    
    if (!leadId || !vehicleId || !createdAt || !encPayload) {
      return NextResponse.json({ 
        error: 'Missing required fields: leadId, vehicleId, createdAt, encPayload' 
      }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from('leads').upsert({
      id: leadId,
      dealer_id: dealerId ?? null,
      vehicle_id: vehicleId,
      vin,
      enc_payload: encPayload,
      consent: true,
      created_at: new Date(createdAt).toISOString(),
      status: 'new',
      source: 'chatgpt',
      user_id: null,
      inventory_source: inventorySource ?? 'uvs_db',
      routing_status: routingStatus ?? 'dealer_assigned',
      flow_id: flowId ?? null,
      external_listing_id: externalListingId ?? null,
      vehicle_snapshot: vehicleSnapshot ?? null,
    }, { onConflict: 'id' });

    if (error) {
      console.error('Lead ingest Supabase error', {
        leadId,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: 'Unable to persist lead' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Lead ingest error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

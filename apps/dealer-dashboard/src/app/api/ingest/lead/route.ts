import { NextRequest, NextResponse } from 'next/server';
import { upsertLead } from '../../../../lib/db';

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
    const { leadId, dealerId, vehicleId, vin, createdAt, encPayload } = body;
    
    if (!leadId || !vehicleId || !createdAt || !encPayload) {
      return NextResponse.json({ 
        error: 'Missing required fields: leadId, vehicleId, createdAt, encPayload' 
      }, { status: 400 });
    }

    // Store the lead
    upsertLead({
      id: leadId,
      dealerId,
      vehicleId,
      vin,
      encPayload,
      createdAt,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Lead ingest error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

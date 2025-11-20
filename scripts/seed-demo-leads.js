#!/usr/bin/env node

/**
 * Seed Demo Leads for Rock Hill GMC
 * 
 * Creates 10-15 fake leads with encrypted payloads in Supabase
 * 
 * Usage:
 *   node scripts/seed-demo-leads.js
 * 
 * Requires:
 *   - SUPABASE_SERVICE_ROLE_KEY in apps/dealer-dashboard/.env.local
 *   - NEXT_PUBLIC_SUPABASE_URL in apps/dealer-dashboard/.env.local
 *   - LEAD_ENC_KEY in apps/dealer-dashboard/.env.local (or will generate one)
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { nanoid } = require('nanoid');
const sodium = require('libsodium-wrappers');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LEAD_ENC_KEY = process.env.LEAD_ENC_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEMO_EMAIL = 'demo@autoagent.com';
const ROCK_HILL_DEALER_ID = '11042155';

// Initialize encryption key
let encryptionKey = null;
function getEncryptionKey() {
  if (encryptionKey) return encryptionKey;
  
  if (LEAD_ENC_KEY) {
    encryptionKey = new Uint8Array(Buffer.from(LEAD_ENC_KEY, 'base64'));
    if (encryptionKey.length !== 32) {
      throw new Error('LEAD_ENC_KEY must be 32 bytes (base64 encoded)');
    }
  } else {
    // Generate a random key for seeding (not recommended for production)
    console.warn('⚠️  LEAD_ENC_KEY not set, using random key for seeding');
    encryptionKey = new Uint8Array(32);
    crypto.getRandomValues(encryptionKey);
  }
  
  return encryptionKey;
}

// Mock lead data
const mockLeads = [
  { name: 'John Smith', email: 'john.smith@email.com', phone: '(704) 555-0123', message: 'Interested in the 2025 GMC Yukon. When can I schedule a test drive?', preferredTime: 'Weekend mornings' },
  { name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(704) 555-0124', message: 'Looking for a reliable pickup truck. The Sierra 2500HD looks perfect.', preferredTime: 'Weekday afternoons' },
  { name: 'Michael Chen', email: 'mchen@email.com', phone: '(704) 555-0125', message: 'Interested in financing options for the 2026 Sierra Denali.', preferredTime: 'Evenings' },
  { name: 'Emily Rodriguez', email: 'emily.r@email.com', phone: '(704) 555-0126', message: 'Do you have the Sierra 2500HD AT4 in stock? Looking to buy this week.', preferredTime: 'Any time' },
  { name: 'David Williams', email: 'dwilliams@email.com', phone: '(704) 555-0127', message: 'Interested in trade-in value for my 2020 F-150. Looking at the Sierra 3500HD.', preferredTime: 'Weekend afternoons' },
  { name: 'Jessica Brown', email: 'jessica.b@email.com', phone: '(704) 555-0128', message: 'Can you provide more details on the Denali Ultimate trim?', preferredTime: 'Weekday mornings' },
  { name: 'Robert Taylor', email: 'rtaylor@email.com', phone: '(704) 555-0129', message: 'Looking for a work truck. The Sierra 2500HD seems ideal.', preferredTime: 'Weekdays' },
  { name: 'Amanda Martinez', email: 'amanda.m@email.com', phone: '(704) 555-0130', message: 'Interested in the Yukon Elevation. What colors are available?', preferredTime: 'Weekend mornings' },
  { name: 'Christopher Lee', email: 'clee@email.com', phone: '(704) 555-0131', message: 'Do you offer fleet pricing? Looking to purchase 3 Sierra trucks.', preferredTime: 'Business hours' },
  { name: 'Michelle Garcia', email: 'mgarcia@email.com', phone: '(704) 555-0132', message: 'Interested in the Sierra Denali. Can I schedule a test drive?', preferredTime: 'Weekend afternoons' },
  { name: 'James Anderson', email: 'janderson@email.com', phone: '(704) 555-0133', message: 'Looking for a family SUV. The Yukon looks spacious.', preferredTime: 'Weekend mornings' },
  { name: 'Lisa Thompson', email: 'lthompson@email.com', phone: '(704) 555-0134', message: 'Interested in the Sierra 2500HD AT4. What financing options do you have?', preferredTime: 'Weekdays' },
  { name: 'Daniel White', email: 'dwhite@email.com', phone: '(704) 555-0135', message: 'Can you provide a quote for the Sierra 3500HD Denali Ultimate?', preferredTime: 'Any time' },
  { name: 'Jennifer Harris', email: 'jharris@email.com', phone: '(704) 555-0136', message: 'Interested in the Yukon. Do you have any special promotions?', preferredTime: 'Weekend afternoons' },
  { name: 'Matthew Clark', email: 'mclark@email.com', phone: '(704) 555-0137', message: 'Looking for a reliable truck for my construction business. Sierra 2500HD seems perfect.', preferredTime: 'Weekday mornings' },
];

// Encrypt payload using libsodium (same as MCP server)
async function encryptPayload(payload) {
  await sodium.ready;
  
  const key = getEncryptionKey();
  const plaintext = JSON.stringify(payload);
  const plaintextBytes = sodium.from_string(plaintext);
  
  // Generate random nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  
  // Encrypt with XSalsa20-Poly1305
  const ciphertext = sodium.crypto_secretbox_easy(plaintextBytes, nonce, key);
  
  // Combine nonce + ciphertext and encode as base64
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);
  
  return Buffer.from(combined).toString('base64');
}

async function seedDemoLeads() {
  console.log('🌱 Seeding demo leads for Rock Hill GMC\n');

  try {
    // Step 1: Get demo user ID
    console.log('📝 Step 1: Finding demo user...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;

    const demoUser = users.users.find(u => u.email === DEMO_EMAIL);
    if (!demoUser) {
      console.error(`❌ Demo user ${DEMO_EMAIL} not found`);
      console.error('   Run scripts/setup-vercel-demo.js first');
      process.exit(1);
    }

    const demoUserId = demoUser.id;
    console.log(`✅ Found demo user: ${demoUserId}\n`);

    // Step 2: Get Rock Hill GMC vehicles
    console.log('📝 Step 2: Finding Rock Hill GMC vehicles...');
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('inventory_vehicles')
      .select('id, vin, year, make, model')
      .eq('dealer_id', ROCK_HILL_DEALER_ID)
      .limit(15);

    if (vehiclesError) throw vehiclesError;

    if (!vehicles || vehicles.length === 0) {
      console.error('❌ No vehicles found for Rock Hill GMC');
      console.error('   Run MarketCheck sync first');
      process.exit(1);
    }

    console.log(`✅ Found ${vehicles.length} vehicles\n`);

    // Step 3: Get dealership ID
    console.log('📝 Step 3: Finding Rock Hill GMC dealership...');
    const { data: dealerships, error: dealershipError } = await supabase
      .from('dealerships')
      .select('id')
      .eq('marketcheck_dealer_id', ROCK_HILL_DEALER_ID)
      .limit(1);

    if (dealershipError) throw dealershipError;

    if (!dealerships || dealerships.length === 0) {
      console.error('❌ Rock Hill GMC dealership not found');
      console.error('   Run scripts/setup-vercel-demo.js first');
      process.exit(1);
    }

    const dealershipId = dealerships[0].id;
    console.log(`✅ Found dealership: ${dealershipId}\n`);

    // Step 4: Delete existing demo leads
    console.log('📝 Step 4: Cleaning up existing demo leads...');
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('user_id', demoUserId)
      .eq('dealer_id', ROCK_HILL_DEALER_ID);

    if (deleteError) {
      console.warn('⚠️  Error deleting existing leads:', deleteError.message);
    } else {
      console.log('✅ Cleaned up existing leads\n');
    }

    // Step 5: Create leads
    console.log('📝 Step 5: Creating demo leads...');
    const leadsToInsert = [];
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < Math.min(mockLeads.length, vehicles.length); i++) {
      const mockLead = mockLeads[i];
      const vehicle = vehicles[i];
      
      // Spread created_at over last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date(thirtyDaysAgo + (daysAgo * 24 * 60 * 60 * 1000));
      
      // Create encrypted payload
      const payload = {
        user: {
          name: mockLead.name,
          email: mockLead.email,
          phone: mockLead.phone,
          preferredTime: mockLead.preferredTime,
        },
        vehicleId: vehicle.id,
        dealerId: ROCK_HILL_DEALER_ID,
        vin: vehicle.vin,
      };

      const encPayload = await encryptPayload(payload);

      // Mix of statuses for demo
      const leadStatuses = ['new', 'contacted', 'qualified', 'closed', 'test_drive_booked'];
      const status = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];
      
      leadsToInsert.push({
        id: nanoid(),
        dealer_id: ROCK_HILL_DEALER_ID,
        vehicle_id: vehicle.id,
        vin: vehicle.vin,
        enc_payload: encPayload,
        consent: true,
        user_id: demoUserId,
        created_at: createdAt.toISOString(),
        status: status,
        source: 'chatgpt',
      });
    }

    const { error: insertError } = await supabase
      .from('leads')
      .insert(leadsToInsert);

    if (insertError) throw insertError;

    console.log(`✅ Created ${leadsToInsert.length} demo leads\n`);

    // Step 6: Create delivery logs for some leads
    console.log('📝 Step 6: Creating delivery logs...');
    const deliveryLogs = [];
    const statuses = ['success', 'success', 'success', 'failed', 'pending'];
    const methods = ['http', 'email'];

    for (let i = 0; i < Math.min(leadsToInsert.length, 10); i++) {
      const lead = leadsToInsert[i];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];
      
      // Create ADF XML payload (simplified)
      const adfXml = `<?xml version="1.0"?>
<adf>
  <prospect>
    <customer>
      <contact>
        <name part="full">${mockLeads[i].name}</name>
        <email>${mockLeads[i].email}</email>
        <phone type="voice">${mockLeads[i].phone}</phone>
      </contact>
    </customer>
    <vehicle>
      <year>${vehicles[i].year}</year>
      <make>${vehicles[i].make}</make>
      <model>${vehicles[i].model}</model>
      <vin>${vehicles[i].vin}</vin>
    </vehicle>
  </prospect>
</adf>`;

      deliveryLogs.push({
        lead_id: lead.id,
        user_id: demoUserId,
        dealer_id: ROCK_HILL_DEALER_ID,
        delivery_method: method,
        delivery_target: method === 'http' ? 'https://example.com/crm/endpoint' : 'crm@example.com',
        status: status,
        http_status: status === 'success' ? 200 : status === 'failed' ? 500 : null,
        error_message: status === 'failed' ? 'Connection timeout' : null,
        adf_payload: adfXml,
        attempted_at: new Date(lead.created_at).toISOString(),
      });
    }

    const { error: logError } = await supabase
      .from('lead_delivery_logs')
      .insert(deliveryLogs);

    if (logError) {
      console.warn('⚠️  Error creating delivery logs:', logError.message);
    } else {
      console.log(`✅ Created ${deliveryLogs.length} delivery logs\n`);
    }

    // Success summary
    console.log('='.repeat(50));
    console.log('✅ Demo Leads Seeding Complete!');
    console.log('='.repeat(50));
    console.log(`Leads created: ${leadsToInsert.length}`);
    console.log(`Delivery logs: ${deliveryLogs.length}`);
    console.log(`Dealership: Rock Hill GMC (${dealershipId})`);
    console.log(`Dealer ID: ${ROCK_HILL_DEALER_ID}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

seedDemoLeads();


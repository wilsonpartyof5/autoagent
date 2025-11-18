/**
 * Test lead delivery to httpbin.org endpoint
 * Submits a test lead and verifies delivery log
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MCP_URL = process.env.MCP_URL || 'http://localhost:8787';

if (!SUPABASE_URL) {
  console.error("❌ Supabase URL not found");
  process.exit(1);
}

const supabaseKey = SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseKey) {
  console.error("❌ Supabase key not found");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, supabaseKey);

async function testLeadDelivery() {
  console.log("🧪 Testing Lead Delivery to httpbin.org\n");

  // Step 1: Get user and configure lead delivery settings
  let userId = null;
  if (SUPABASE_SERVICE_KEY) {
    const { data: users } = await supabase.auth.admin.listUsers();
    if (users && users.users.length > 0) {
      userId = users.users[0].id;
      console.log(`✅ Found user: ${userId}\n`);
    }
  }

  if (!userId) {
    console.log("⚠️  Cannot determine user_id automatically");
    console.log("   Please configure lead delivery settings manually in /app/settings");
    console.log("   Set HTTP endpoint to: https://httpbin.org/post\n");
    return;
  }

  // Configure lead delivery settings
  console.log("📝 Configuring lead delivery settings...");
  const { error: configError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      lead_delivery_method: 'http',
      lead_delivery_endpoint: 'https://httpbin.org/post',
      lead_delivery_email: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (configError) {
    console.error("❌ Error configuring delivery:", configError.message);
    console.log("\n⚠️  Please configure manually:");
    console.log("   1. Go to http://localhost:3000/app/settings");
    console.log("   2. Set Delivery Method: HTTP Endpoint");
    console.log("   3. Set HTTP Endpoint URL: https://httpbin.org/post");
    console.log("   4. Save settings\n");
  } else {
    console.log("✅ Lead delivery configured: https://httpbin.org/post\n");
  }

  // Step 2: Get a vehicle from inventory
  const { data: vehicles } = await supabase
    .from('inventory_vehicles')
    .select('id, vin, year, make, model, dealer_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!vehicles || vehicles.length === 0) {
    console.error("❌ No vehicles found in inventory");
    console.log("   Please seed inventory first using scripts/seed-demo-inventory.sql\n");
    return;
  }

  const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles;
  console.log(`🚗 Using vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (VIN: ${vehicle.vin})\n`);

  // Step 3: Submit lead via MCP (if server is running) or simulate
  console.log("📤 Submitting test lead...\n");

  const testLead = {
    vehicleId: vehicle.id,
    vin: vehicle.vin,
    dealerId: vehicle.dealer_id || '10015450',
    user: {
      name: 'Test User',
      email: 'test@example.com',
      phone: '555-123-4567',
      preferredTime: 'Morning',
    },
    consent: true,
  };

  // Try MCP endpoint
  try {
    const mcpResponse = await fetch(`${MCP_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'submit-lead',
          arguments: testLead,
        },
      }),
    });

    const mcpResult = await mcpResponse.json();
    if (mcpResult.result?.success) {
      console.log("✅ Lead submitted via MCP");
      console.log(`   Lead ID: ${mcpResult.result.structuredContent?.leadId}\n`);
    } else {
      console.log("⚠️  MCP submission failed, will check delivery logs directly\n");
    }
  } catch (error) {
    console.log(`⚠️  MCP server not accessible at ${MCP_URL}`);
    console.log("   Lead delivery will be tested when MCP server is running\n");
  }

  // Step 4: Wait a moment for delivery to process
  console.log("⏳ Waiting 3 seconds for delivery to process...\n");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 5: Check delivery logs
  console.log("📋 Checking delivery logs...\n");
  const { data: logs, error: logError } = await supabase
    .from('lead_delivery_logs')
    .select('*')
    .eq('user_id', userId)
    .order('attempted_at', { ascending: false })
    .limit(5);

  if (logError) {
    console.error("❌ Error fetching logs:", logError.message);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("⚠️  No delivery logs found");
    console.log("   This could mean:");
    console.log("   1. Lead delivery hasn't run yet (check MCP server logs)");
    console.log("   2. Delivery service needs SUPABASE_SERVICE_ROLE_KEY configured");
    console.log("   3. Lead was submitted but delivery failed silently\n");
    return;
  }

  const latestLog = logs[0];
  console.log("✅ Latest delivery log:");
  console.log(`   Lead ID: ${latestLog.lead_id}`);
  console.log(`   Method: ${latestLog.delivery_method}`);
  console.log(`   Target: ${latestLog.delivery_target}`);
  console.log(`   Status: ${latestLog.status}`);
  if (latestLog.http_status) {
    console.log(`   HTTP Status: ${latestLog.http_status}`);
  }
  if (latestLog.error_message) {
    console.log(`   Error: ${latestLog.error_message}`);
  }
  if (latestLog.response_body) {
    const bodyPreview = latestLog.response_body.substring(0, 200);
    console.log(`   Response: ${bodyPreview}...`);
  }
  console.log(`   Attempted: ${latestLog.attempted_at}\n`);

  // Step 6: Verify on httpbin.org
  if (latestLog.delivery_target.includes('httpbin.org')) {
    console.log("🌐 Check httpbin.org/post to see the ADF XML payload:");
    console.log("   https://httpbin.org/post\n");
  }

  return latestLog;
}

testLeadDelivery().catch(console.error);


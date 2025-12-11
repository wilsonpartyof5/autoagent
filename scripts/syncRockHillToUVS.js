/**
 * Sync Rock Hill GMC inventory from MarketCheck to UVS
 * 
 * This script:
 * 1. Fetches inventory from MarketCheck API
 * 2. Ingests into UVS via the MCP server ingestion API
 * 3. Verifies the import by querying UVS
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY;
// Use production Railway URL or explicit override
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 
                       process.env.INGESTION_SERVICE_URL || 
                       'https://autoagentmcp-server-production.up.railway.app';
const INGESTION_TOKEN = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Rock Hill GMC configuration
const DEALER_ID = "11042155";
const DEALER_SOURCE = "myrockhillgmc.com";
const DEALER_NAME = "Rock Hill GMC";

if (!MARKETCHECK_API_KEY) {
  console.error("❌ MARKETCHECK_API_KEY not found in environment");
  console.error("   Set it in apps/mcp-server/.env");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Supabase credentials not found");
  console.error("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Fetch inventory from MarketCheck API
 */
async function fetchMarketCheckInventory() {
  console.log("📡 Fetching inventory from MarketCheck...");
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   Source: ${DEALER_SOURCE}\n`);

  const baseUrl = 'https://mc-api.marketcheck.com';
  const url = new URL('/v2/car/dealer/inventory/active', baseUrl);
  url.searchParams.set('api_key', MARKETCHECK_API_KEY);
  url.searchParams.set('source', DEALER_SOURCE);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', '100');

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MarketCheck API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const listings = Array.isArray(data.listings) ? data.listings : [];
    const numFound = data.num_found || 0;

    console.log(`✅ Fetched ${listings.length} vehicles (${numFound} total available)\n`);
    
    if (listings.length === 0) {
      console.log("⚠️  No vehicles found. Check dealer ID and source.\n");
      return [];
    }

    // Log sample vehicle
    if (listings[0]) {
      const v = listings[0];
      console.log("📋 Sample vehicle:");
      console.log(`   ${v.build?.year || 'N/A'} ${v.build?.make || 'N/A'} ${v.build?.model || 'N/A'}`);
      console.log(`   Price: $${v.price || 'N/A'}`);
      console.log(`   VIN: ${v.vin || 'N/A'}\n`);
    }

    return listings;
  } catch (error) {
    console.error("❌ Error fetching from MarketCheck:", error.message);
    throw error;
  }
}

/**
 * Sync inventory via dealer dashboard API (which handles UVS ingestion)
 */
async function syncViaDashboard() {
  console.log(`🚀 Syncing Rock Hill GMC inventory via dashboard API...`);
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   ZIP: 29730\n`);

  const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.VERCEL_URL || 'https://autoagent-dealer-dashboard.vercel.app';
  const DASHBOARD_TOKEN = process.env.DASHBOARD_INGEST_TOKEN;

  if (!DASHBOARD_TOKEN) {
    throw new Error('DASHBOARD_INGEST_TOKEN is required for dashboard sync');
  }

  const url = `${DASHBOARD_URL}/api/inventory/sync`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHBOARD_TOKEN}`,
      },
      body: JSON.stringify({
        dealerId: DEALER_ID,
        zip: '29730',
        condition: 'all',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Dashboard sync error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += `: ${JSON.stringify(errorJson, null, 2)}`;
      } catch {
        errorMessage += `: ${errorText.substring(0, 500)}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    console.log("✅ Sync complete!");
    console.log(`   Imported: ${result.imported || 0} vehicles\n`);

    return result;
  } catch (error) {
    console.error("❌ Error syncing via dashboard:", error.message);
    throw error;
  }
}

/**
 * Verify imported vehicles in UVS
 */
async function verifyUVSImport() {
  console.log("🔍 Verifying UVS import...\n");

  try {
    // Query UVS vehicles for Rock Hill GMC
    const { data: vehicles, error } = await supabase
      .from('uvs_vehicles')
      .select('id, vin, make, model, year, price, dealer_name, dealer_latitude, dealer_longitude, primary_photo_url, availability_status')
      .eq('dealer_id', DEALER_ID)
      .eq('availability_status', 'available')
      .order('last_synced_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("❌ Error querying UVS:", error.message);
      return null;
    }

    if (!vehicles || vehicles.length === 0) {
      console.log("⚠️  No vehicles found in UVS for dealer " + DEALER_ID);
      console.log("   The import may have failed or vehicles may be marked unavailable\n");
      return null;
    }

    console.log(`✅ Found ${vehicles.length} vehicles in UVS:\n`);

    // Check data completeness
    let withCoords = 0;
    let withPhotos = 0;
    let withPrice = 0;
    let withDealerName = 0;

    vehicles.forEach((v, i) => {
      const hasCoords = v.dealer_latitude && v.dealer_longitude;
      const hasPhoto = !!v.primary_photo_url;
      const hasPrice = !!v.price;
      const hasDealerName = !!v.dealer_name;

      if (hasCoords) withCoords++;
      if (hasPhoto) withPhotos++;
      if (hasPrice) withPrice++;
      if (hasDealerName) withDealerName++;

      console.log(`${i + 1}. ${v.year || 'N/A'} ${v.make || 'N/A'} ${v.model || 'N/A'}`);
      console.log(`   VIN: ${v.vin || 'N/A'}`);
      console.log(`   Price: ${v.price ? '$' + v.price.toLocaleString() : 'N/A'}`);
      console.log(`   Dealer: ${v.dealer_name || 'N/A'}`);
      console.log(`   Location: ${hasCoords ? `${v.dealer_latitude}, ${v.dealer_longitude}` : 'N/A'}`);
      console.log(`   Photo: ${hasPhoto ? '✅' : '❌'}`);
      console.log('');
    });

    // Get total count
    const { count } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', DEALER_ID)
      .eq('availability_status', 'available');

    console.log("📊 Data Completeness:");
    console.log(`   Total available vehicles: ${count || 0}`);
    console.log(`   With coordinates (lat/lng): ${withCoords}/${vehicles.length}`);
    console.log(`   With photos: ${withPhotos}/${vehicles.length}`);
    console.log(`   With price: ${withPrice}/${vehicles.length}`);
    console.log(`   With dealer name: ${withDealerName}/${vehicles.length}\n`);

    return vehicles;
  } catch (error) {
    console.error("❌ Error verifying import:", error.message);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Rock Hill GMC → UVS Inventory Sync");
  console.log("=".repeat(60));
  console.log("");

  try {
    // Step 1: Sync via dashboard API (which fetches from MarketCheck and ingests to UVS)
    const syncResult = await syncViaDashboard();

    // Step 3: Wait a moment for processing
    console.log("⏳ Waiting 3 seconds for processing...\n");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Verify import
    await verifyUVSImport();

    console.log("=".repeat(60));
    console.log("✅ Sync complete!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Sync failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);


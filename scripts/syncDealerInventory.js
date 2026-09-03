/**
 * Sync MarketCheck dealer inventory to Drevvy
 * 
 * This script:
 * 1. Updates the Supabase profile with marketcheck_dealer_id
 * 2. Triggers the inventory sync via API
 */

const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load .env from multiple possible locations
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

// Load dealer info from previous fetch
const DEALER_INFO_FILE = path.join(__dirname, "..", "temp", "dealer-10015450-info.json");

if (!fs.existsSync(DEALER_INFO_FILE)) {
  console.error("❌ Dealer info file not found. Run fetchDealerInventory.js first.");
  process.exit(1);
}

const dealerInfo = JSON.parse(fs.readFileSync(DEALER_INFO_FILE, "utf8"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const DASHBOARD_INGEST_TOKEN = process.env.DASHBOARD_INGEST_TOKEN;
const DASHBOARD_URL = process.env.DASHBOARD_INGEST_URL || "http://localhost:3000";

async function updateProfile(dealerId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Supabase credentials not found in environment variables.");
    console.error("   Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return false;
  }

  console.log(`\n📝 Updating Supabase profile with dealer ID: ${dealerId}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  
  // Note: This requires authentication. In a real scenario, you'd need to:
  // 1. Authenticate with Supabase to get a user session
  // 2. Use that session to update the profile
  // 
  // For now, we'll document the manual steps or use the API route
  
  console.log("⚠️  Profile update requires authentication.");
  console.log("   Manual steps:");
  console.log(`   1. Log into the dashboard at ${DASHBOARD_URL}`);
  console.log(`   2. Go to /app/settings`);
  console.log(`   3. Enter dealer ID: ${dealerId}`);
  console.log(`   4. Save settings`);
  console.log("\n   OR use the API route (see syncInventory function below)\n");
  
  return true;
}

async function syncInventory(dealerId) {
  if (!DASHBOARD_INGEST_TOKEN) {
    console.error("❌ DASHBOARD_INGEST_TOKEN not found in environment variables.");
    console.error("   Cannot trigger sync via API. Use the dashboard UI instead:");
    console.error(`   1. Go to ${DASHBOARD_URL}/app/setup`);
    console.error(`   2. Enter dealer ID: ${dealerId}`);
    console.error(`   3. Click "Sync Inventory"`);
    return false;
  }

  const syncUrl = `${DASHBOARD_URL}/api/inventory/sync`;
  
  console.log(`\n🔄 Triggering inventory sync via API...`);
  console.log(`   URL: ${syncUrl}`);
  console.log(`   Dealer ID: ${dealerId}\n`);

  try {
    const response = await axios.post(
      syncUrl,
      {
        dealerId: dealerId.toString(),
        pageSize: 5, // Limit to 5 vehicles for test
      },
      {
        headers: {
          "Authorization": `Bearer ${DASHBOARD_INGEST_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Sync successful!");
    console.log(`   Imported: ${response.data.imported} vehicles`);
    return true;
  } catch (error) {
    console.error("❌ Sync failed:", error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error("   Authentication failed. Check DASHBOARD_INGEST_TOKEN.");
    }
    return false;
  }
}

async function main() {
  console.log("🚀 Drevvy MarketCheck Inventory Sync");
  console.log("========================================");
  console.log(`\nDealer: ${dealerInfo.name}`);
  console.log(`ID: ${dealerInfo.id}`);
  console.log(`Location: ${dealerInfo.city}, ${dealerInfo.state}`);
  console.log(`Website: ${dealerInfo.website || 'N/A'}`);

  // Update profile (documented, requires manual step or auth)
  await updateProfile(dealerInfo.id);

  // Try to sync via API
  const syncSuccess = await syncInventory(dealerInfo.id);

  if (syncSuccess) {
    console.log(`\n✅ Sync completed! Check ${DASHBOARD_URL}/app/inventory to see the vehicles.`);
  } else {
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Update profile: Go to ${DASHBOARD_URL}/app/settings`);
    console.log(`   2. Enter dealer ID: ${dealerInfo.id}`);
    console.log(`   3. Sync inventory: Go to ${DASHBOARD_URL}/app/setup`);
    console.log(`   4. Click "Sync Inventory"`);
    console.log(`   5. Verify: Check ${DASHBOARD_URL}/app/inventory`);
  }
}

main().catch(console.error);


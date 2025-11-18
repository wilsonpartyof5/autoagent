/**
 * Trigger MarketCheck sync for My Rock Hill GMC via API route
 * Requires DASHBOARD_INGEST_TOKEN in environment
 */

const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const DASHBOARD_INGEST_TOKEN = process.env.DASHBOARD_INGEST_TOKEN;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const DEALER_ID = "11042155";
const ZIP = "29730";

if (!DASHBOARD_INGEST_TOKEN) {
  console.error("❌ DASHBOARD_INGEST_TOKEN not found in environment");
  console.log("\n💡 Alternative: Run sync from dashboard UI:");
  console.log("   1. Sign in at http://localhost:3000/auth");
  console.log("   2. Navigate to http://localhost:3000/app/setup");
  console.log("   3. Ensure dealer ID is set to 11042155");
  console.log("   4. Click 'Sync Inventory' button");
  console.log("   5. Watch server logs for [syncMarketCheckInventory] entries\n");
  process.exit(1);
}

async function triggerSync() {
  console.log("🚀 Triggering MarketCheck sync for My Rock Hill GMC\n");
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   ZIP: ${ZIP}`);
  console.log(`   Endpoint: ${DASHBOARD_URL}/api/inventory/sync\n`);

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/inventory/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHBOARD_INGEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealerId: DEALER_ID,
        zip: ZIP,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Sync triggered successfully!");
      console.log(`   Imported: ${data.imported || 0} vehicles\n`);
      console.log("💡 Check server logs for detailed [syncMarketCheckInventory] entries");
      console.log("   Verify inventory at: http://localhost:3000/app/inventory\n");
    } else {
      console.error("❌ Sync failed:");
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
    console.log("\n💡 Make sure the dashboard server is running:");
    console.log("   pnpm --filter dealer-dashboard dev\n");
  }
}

triggerSync();


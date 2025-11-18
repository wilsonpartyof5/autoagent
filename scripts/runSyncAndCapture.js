/**
 * Run MarketCheck sync and capture results
 */

const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load .env from multiple possible locations
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const DEALER_ID = "10015450";
const ZIP = "77375";
// Fix: DASHBOARD_INGEST_URL might be set to the ingest endpoint, not the base URL
const DASHBOARD_BASE_URL = process.env.DASHBOARD_INGEST_URL?.replace(/\/api\/ingest.*$/, '') || "http://localhost:3000";
const DASHBOARD_URL = DASHBOARD_BASE_URL;
const DASHBOARD_INGEST_TOKEN = process.env.DASHBOARD_INGEST_TOKEN;

async function runSync() {
  console.log("🚀 Running MarketCheck Sync");
  console.log("============================");
  console.log(`Dealer ID: ${DEALER_ID}`);
  console.log(`ZIP: ${ZIP}`);
  console.log(`Dashboard URL: ${DASHBOARD_URL}\n`);

  if (!DASHBOARD_INGEST_TOKEN) {
    console.error("❌ DASHBOARD_INGEST_TOKEN not found in environment variables.");
    console.error("\n📋 Manual sync steps:");
    console.error(`   1. Navigate to ${DASHBOARD_URL}/app/setup`);
    console.error(`   2. Enter Dealer ID: ${DEALER_ID}`);
    console.error(`   3. Enter ZIP: ${ZIP}`);
    console.error(`   4. Click "Sync Inventory"`);
    console.error(`   5. Check console logs for sync results`);
    console.error(`   6. Navigate to ${DASHBOARD_URL}/app/inventory to verify`);
    return false;
  }

  const syncUrl = `${DASHBOARD_URL}/api/inventory/sync`;
  
  console.log(`🔄 Triggering sync via API...`);
  console.log(`   URL: ${syncUrl}\n`);

  try {
    const startTime = new Date();
    const response = await axios.post(
      syncUrl,
      {
        dealerId: DEALER_ID,
        zip: ZIP,
        pageSize: 100, // Get all available vehicles
      },
      {
        headers: {
          "Authorization": `Bearer ${DASHBOARD_INGEST_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout
      }
    );

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("✅ Sync completed successfully!");
    console.log(`   Duration: ${duration}s`);
    console.log(`   Imported: ${response.data.imported} vehicles`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));

    // Save sync results
    const resultsFile = path.join(__dirname, "..", "temp", `sync-results-${DEALER_ID}.json`);
    const resultsDir = path.dirname(resultsFile);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const syncResults = {
      timestamp: new Date().toISOString(),
      dealerId: DEALER_ID,
      zip: ZIP,
      duration: `${duration}s`,
      imported: response.data.imported,
      response: response.data,
    };

    fs.writeFileSync(resultsFile, JSON.stringify(syncResults, null, 2));
    console.log(`\n📁 Sync results saved to: ${resultsFile}`);

    console.log(`\n📋 Next steps:`);
    console.log(`   1. Check ${DASHBOARD_URL}/app/inventory to see imported vehicles`);
    console.log(`   2. Check server console logs for enrichment stats`);
    console.log(`   3. Look for log line: "inventory_sync" with enrichedCount`);

    return true;
  } catch (error) {
    console.error("\n❌ Sync failed!");
    console.error(`   Status: ${error.response?.status || 'N/A'}`);
    console.error(`   Error: ${error.response?.data || error.message}`);
    
    if (error.response?.status === 401) {
      console.error("\n   Authentication failed. Check DASHBOARD_INGEST_TOKEN.");
    } else if (error.response?.status === 500) {
      console.error("\n   Server error. Check dashboard logs for details.");
    }

    // Save error details
    const errorFile = path.join(__dirname, "..", "temp", `sync-error-${DEALER_ID}.json`);
    const errorDir = path.dirname(errorFile);
    if (!fs.existsSync(errorDir)) {
      fs.mkdirSync(errorDir, { recursive: true });
    }

    fs.writeFileSync(errorFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      dealerId: DEALER_ID,
      zip: ZIP,
      error: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      }
    }, null, 2));

    console.error(`\n📁 Error details saved to: ${errorFile}`);
    return false;
  }
}

runSync().catch(console.error);


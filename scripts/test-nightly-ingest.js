/**
 * Test script for nightly ingestion endpoint
 * 
 * Usage:
 *   node scripts/test-nightly-ingest.js
 * 
 * Requires environment variables:
 *   - DASHBOARD_URL (default: http://localhost:3000)
 *   - INGESTION_API_TOKEN or MCP_SERVER_TOKEN
 */

const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.VERCEL_URL || 'http://localhost:3000';
const INGESTION_TOKEN = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;

if (!INGESTION_TOKEN) {
  console.error("❌ INGESTION_API_TOKEN or MCP_SERVER_TOKEN not found");
  console.error("   Set it in apps/dealer-dashboard/.env.local or apps/mcp-server/.env");
  process.exit(1);
}

async function testNightlyIngest() {
  console.log("=".repeat(60));
  console.log("Testing Nightly Ingestion Endpoint");
  console.log("=".repeat(60));
  console.log(`Dashboard URL: ${DASHBOARD_URL}`);
  console.log(`Token: ${INGESTION_TOKEN.substring(0, 10)}...`);
  console.log("");

  const url = `${DASHBOARD_URL}/api/ingest/nightly`;

  try {
    console.log("📡 Calling nightly ingestion endpoint...");
    console.log(`   URL: ${url}\n`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGESTION_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
        if (errorJson.message) {
          errorMessage += `: ${errorJson.message}`;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 500)}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    console.log("✅ Nightly ingestion completed successfully!\n");
    console.log("📊 Results:");
    console.log(`   Processed: ${result.processed || 0} dealerships`);
    console.log(`   Succeeded: ${result.succeeded || 0}`);
    console.log(`   Failed: ${result.failed || 0}`);
    console.log(`   Total Imported: ${result.totalImported || 0} vehicles\n`);

    if (result.results && result.results.length > 0) {
      console.log("✅ Successful Syncs:");
      result.results.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.dealershipName} (${r.dealerId})`);
        console.log(`      Fetched: ${r.fetched}, Imported: ${r.imported}, Valid: ${r.valid}, Invalid: ${r.invalid}`);
      });
      console.log("");
    }

    if (result.errors && result.errors.length > 0) {
      console.log("❌ Failed Syncs:");
      result.errors.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.dealershipName} (${e.dealerId})`);
        console.log(`      Error: ${e.error}`);
      });
      console.log("");
    }

    console.log("=".repeat(60));
    console.log("✅ Test complete!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Ensure the dashboard server is running");
    console.error("   2. Check that INGESTION_API_TOKEN is set correctly");
    console.error("   3. Verify MCP_SERVER_URL is configured in dashboard env");
    console.error("   4. Check server logs for detailed error messages\n");
    process.exit(1);
  }
}

testNightlyIngest().catch(console.error);


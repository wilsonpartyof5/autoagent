/**
 * Test script for nightly ingestion endpoint (production)
 * 
 * Usage:
 *   INGESTION_API_TOKEN=<token> DASHBOARD_URL=<url> node scripts/test-nightly-ingest-prod.js
 * 
 * Or:
 *   node scripts/test-nightly-ingest-prod.js <token> <dashboard-url>
 */

const args = process.argv.slice(2);
const INGESTION_TOKEN = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN || args[0];
const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.VERCEL_URL || args[1] || 'https://autoagent-dealer-dashboard.vercel.app';

if (!INGESTION_TOKEN) {
  console.error("❌ INGESTION_API_TOKEN required");
  console.error("   Usage: INGESTION_API_TOKEN=<token> DASHBOARD_URL=<url> node scripts/test-nightly-ingest-prod.js");
  console.error("   Or: node scripts/test-nightly-ingest-prod.js <token> <dashboard-url>");
  process.exit(1);
}

async function testNightlyIngest() {
  console.log("=".repeat(60));
  console.log("Testing Nightly Ingestion Endpoint (Production)");
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
        if (errorJson.details) {
          errorMessage += `\n   Details: ${errorJson.details}`;
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
    
    // Exit with success code
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Verify INGESTION_API_TOKEN is correct");
    console.error("   2. Check that DASHBOARD_URL points to production");
    console.error("   3. Verify MCP_SERVER_URL is set in Vercel env vars");
    console.error("   4. Check server logs for detailed error messages\n");
    process.exit(1);
  }
}

testNightlyIngest().catch(console.error);


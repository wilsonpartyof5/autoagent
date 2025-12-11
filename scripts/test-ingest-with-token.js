/**
 * Test ingestion with token provided as argument or env var
 * 
 * Usage:
 *   INGESTION_API_TOKEN=<token> node scripts/test-ingest-with-token.js
 *   OR
 *   node scripts/test-ingest-with-token.js <token>
 */

const args = process.argv.slice(2);
const INGESTION_TOKEN = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN || args[0];
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL || 'https://autoagentmcp-server-production.up.railway.app';
const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.VERCEL_URL || 'https://autoagent-dealer-dashboard.vercel.app';

if (!INGESTION_TOKEN) {
  console.error("❌ INGESTION_API_TOKEN required");
  console.error("   Usage: INGESTION_API_TOKEN=<token> node scripts/test-ingest-with-token.js");
  console.error("   Or: node scripts/test-ingest-with-token.js <token>");
  process.exit(1);
}

async function testMCPEndpoint() {
  console.log("=".repeat(60));
  console.log("Test 1: MCP Server fetch-and-ingest endpoint");
  console.log("=".repeat(60));
  console.log(`MCP Server: ${MCP_SERVER_URL}`);
  console.log(`Dealer ID: 11042155 (Rock Hill GMC)`);
  console.log(`Source: myrockhillgmc.com\n`);

  const url = `${MCP_SERVER_URL}/api/ingest/marketcheck/fetch-and-ingest`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGESTION_TOKEN}`,
      },
      body: JSON.stringify({
        dealerId: '11042155',
        source: 'myrockhillgmc.com',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
        if (errorJson.details) {
          errorMessage += `: ${errorJson.details}`;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 500)}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    console.log("✅ MCP fetch-and-ingest successful!\n");
    console.log("📊 Results:");
    console.log(`   Fetched from MarketCheck: ${result.fetched || 0} vehicles`);
    
    if (result.ingestion) {
      const summary = result.ingestion.summary || {};
      console.log(`   Stored in UVS: ${summary.stored || 0}`);
      console.log(`   Valid: ${summary.valid || 0}`);
      console.log(`   Invalid: ${summary.invalid || 0}`);
      console.log(`   Updated: ${summary.updated || 0}`);
    }
    console.log("");

    return result;
  } catch (error) {
    console.error("❌ MCP endpoint test failed:", error.message);
    throw error;
  }
}

async function testNightlyEndpoint() {
  console.log("=".repeat(60));
  console.log("Test 2: Dashboard nightly endpoint");
  console.log("=".repeat(60));
  console.log(`Dashboard: ${DASHBOARD_URL}\n`);

  const url = `${DASHBOARD_URL}/api/ingest/nightly`;

  try {
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

    console.log("✅ Nightly endpoint test successful!\n");
    console.log("📊 Results:");
    console.log(`   Processed: ${result.processed || 0} dealerships`);
    console.log(`   Succeeded: ${result.succeeded || 0}`);
    console.log(`   Failed: ${result.failed || 0}`);
    console.log(`   Total Imported: ${result.totalImported || 0} vehicles\n`);

    if (result.results && result.results.length > 0) {
      console.log("✅ Successful Syncs:");
      result.results.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.dealershipName} (${r.dealerId})`);
        console.log(`      Fetched: ${r.fetched}, Imported: ${r.imported}`);
      });
      console.log("");
    }

    return result;
  } catch (error) {
    console.error("❌ Nightly endpoint test failed:", error.message);
    throw error;
  }
}

async function main() {
  try {
    // Test MCP endpoint
    const mcpResult = await testMCPEndpoint();

    // Test nightly endpoint
    const nightlyResult = await testNightlyEndpoint();

    console.log("=".repeat(60));
    console.log("✅ All tests passed!");
    console.log("=".repeat(60));
    console.log("\nSummary:");
    console.log(`   MCP: Fetched ${mcpResult.fetched || 0}, Stored ${mcpResult.ingestion?.summary?.stored || 0}`);
    console.log(`   Nightly: Processed ${nightlyResult.processed || 0}, Imported ${nightlyResult.totalImported || 0}`);
    console.log("");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);


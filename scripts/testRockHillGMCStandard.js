/**
 * Test MarketCheck API for My Rock Hill GMC using standard endpoint with dealer_id
 * Endpoint: https://api.marketcheck.com/v2/search/car/active?dealer_id=11042155
 */

const dotenv = require("dotenv");
const path = require("path");
const https = require("https");

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY;
const DEALER_ID = "11042155";
const BASE_URL = "https://api.marketcheck.com";

if (!MARKETCHECK_API_KEY) {
  console.error("❌ MARKETCHECK_API_KEY not found in environment");
  process.exit(1);
}

async function testStandardEndpoint() {
  const params = new URLSearchParams({
    api_key: MARKETCHECK_API_KEY,
    dealer_id: DEALER_ID,
    page: "1",
    pageSize: "100",
  });

  const url = `${BASE_URL}/v2/search/car/active?${params.toString()}`;
  const urlRedacted = url.replace(MARKETCHECK_API_KEY, "***REDACTED***");

  console.log("\n🔍 Testing MarketCheck Standard Endpoint");
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   URL: ${urlRedacted}\n`);

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const payload = JSON.parse(data);
            const listings = Array.isArray(payload.listings) ? payload.listings : [];

            console.log("✅ API Response:");
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   num_found: ${payload.num_found ?? 0}`);
            console.log(`   listings.length: ${listings.length}`);

            if (listings.length > 0) {
              const first = listings[0];
              console.log(`\n📋 First Listing:`);
              console.log(`   VIN: ${first.vin || "N/A"}`);
              console.log(`   Dealer ID: ${first.dealer?.id || "N/A"}`);
              console.log(`   Dealer Name: ${first.dealer?.name || "N/A"}`);
            }

            resolve({
              status: res.statusCode,
              numFound: payload.num_found ?? 0,
              listingsCount: listings.length,
              works: listings.length > 0,
            });
          } catch (error) {
            console.error("❌ Failed to parse response:", error.message);
            console.log("Raw response:", data.substring(0, 500));
            reject(error);
          }
        });
      })
      .on("error", (error) => {
        console.error("❌ Request failed:", error.message);
        reject(error);
      });
  });
}

testStandardEndpoint()
  .then((result) => {
    console.log("\n" + "=".repeat(60));
    if (result.works) {
      console.log("✅ Standard endpoint works with dealer_id=11042155");
      console.log(`   Found ${result.listingsCount} listings (num_found: ${result.numFound})`);
    } else {
      console.log("⚠️  Standard endpoint returned 0 listings");
      console.log("   May need to use source parameter endpoint instead");
    }
  })
  .catch(console.error);


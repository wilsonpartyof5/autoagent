/**
 * Test MarketCheck dealer sync for dealer 10015450
 * Captures API responses and logs for debugging zero-vehicle issue
 */

const dotenv = require("dotenv");
const path = require("path");
const https = require("https");

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY;
const MARKETCHECK_BASE_URL = process.env.MARKETCHECK_BASE_URL || "https://api.marketcheck.com";
const DEALER_ID = "10015450";
const ZIP = "77375";

if (!MARKETCHECK_API_KEY) {
  console.error("❌ MARKETCHECK_API_KEY not found in environment");
  process.exit(1);
}

async function testMarketCheckAPI(dealerId, zip = null) {
  const baseUrl = MARKETCHECK_BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams({
    api_key: MARKETCHECK_API_KEY,
    dealer_id: dealerId,
    page: "1",
    pageSize: "100",
  });

  if (zip) {
    params.set("zip", zip);
    params.set("radius", "50");
  }

  const url = `${baseUrl}/v2/search/car/active?${params.toString()}`;
  const urlRedacted = url.replace(MARKETCHECK_API_KEY, "***REDACTED***");

  console.log("\n🔍 Testing MarketCheck API");
  console.log(`   Dealer ID: ${dealerId}`);
  console.log(`   ZIP: ${zip || "none"}`);
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
            const firstListing = listings.length > 0 ? listings[0] : null;

            console.log("✅ API Response:");
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   num_found: ${payload.num_found ?? 0}`);
            console.log(`   listings.length: ${listings.length}`);
            console.log(`   page: ${payload.page ?? 1}`);
            console.log(`   pageSize: ${payload.pageSize ?? 100}`);

            if (firstListing) {
              console.log("\n📋 First Listing Sample:");
              console.log(`   VIN: ${firstListing.vin || "N/A"}`);
              console.log(`   ID: ${firstListing.id || "N/A"}`);
              console.log(`   Year: ${firstListing.build?.year || "N/A"}`);
              console.log(`   Make: ${firstListing.build?.make || "N/A"}`);
              console.log(`   Model: ${firstListing.build?.model || "N/A"}`);
              console.log(`   Dealer ID: ${firstListing.dealer?.id || "N/A"}`);
              console.log(`   Dealer Name: ${firstListing.dealer?.name || "N/A"}`);
              console.log(`   Price: ${firstListing.price ?? "N/A"}`);
              console.log(`   Miles: ${firstListing.miles ?? firstListing.mileage ?? "N/A"}`);
            } else {
              console.log("\n⚠️  No listings returned");
            }

            resolve({
              status: res.statusCode,
              numFound: payload.num_found ?? 0,
              listingsCount: listings.length,
              listings: listings,
              payload: payload,
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

async function runTests() {
  console.log("=".repeat(60));
  console.log("MarketCheck Dealer Sync Test");
  console.log("=".repeat(60));

  // Test 1: Without ZIP
  console.log("\n📌 Test 1: Dealer ID only (no ZIP)");
  const result1 = await testMarketCheckAPI(DEALER_ID, null);

  // Test 2: With ZIP
  console.log("\n📌 Test 2: Dealer ID + ZIP");
  const result2 = await testMarketCheckAPI(DEALER_ID, ZIP);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`Test 1 (no ZIP): ${result1.listingsCount} listings (num_found: ${result1.numFound})`);
  console.log(`Test 2 (with ZIP ${ZIP}): ${result2.listingsCount} listings (num_found: ${result2.numFound})`);

  if (result1.listingsCount === 0 && result2.listingsCount === 0) {
    console.log("\n⚠️  WARNING: Both tests returned zero listings!");
    console.log("   This suggests MarketCheck has no active inventory for this dealer.");
  } else if (result1.listingsCount > 0 && result2.listingsCount === 0) {
    console.log("\n⚠️  WARNING: ZIP parameter is filtering out all results!");
    console.log("   The ZIP + radius filter may be too restrictive.");
    console.log("   Recommendation: Try sync without ZIP or increase radius.");
  } else if (result1.listingsCount === 0 && result2.listingsCount > 0) {
    console.log("\n✅ ZIP parameter is required for this dealer.");
  } else {
    console.log("\n✅ Both tests returned listings.");
  }

  console.log("\n💡 Next Steps:");
  console.log("   1. Check server logs during dashboard sync");
  console.log("   2. Look for [syncMarketCheckInventory] log entries");
  console.log("   3. Verify normalization/validation errors");
  console.log("   4. Query Supabase to check if vehicles were inserted");
}

runTests().catch(console.error);


/**
 * Test MarketCheck API for My Rock Hill GMC (dealer 11042155)
 * Uses source parameter: source=myrockhillgmc.com
 * Endpoint: https://mc-api.marketcheck.com/v2/car/dealer/inventory/active
 */

const dotenv = require("dotenv");
const path = require("path");
const https = require("https");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY;
const DEALER_ID = "11042155";
const SOURCE = "myrockhillgmc.com";
const BASE_URL = "https://mc-api.marketcheck.com";

if (!MARKETCHECK_API_KEY) {
  console.error("❌ MARKETCHECK_API_KEY not found in environment");
  process.exit(1);
}

async function testRockHillGMC() {
  const params = new URLSearchParams({
    api_key: MARKETCHECK_API_KEY,
    source: SOURCE,
    page: "1",
    pageSize: "100",
  });

  const url = `${BASE_URL}/v2/car/dealer/inventory/active?${params.toString()}`;
  const urlRedacted = url.replace(MARKETCHECK_API_KEY, "***REDACTED***");

  console.log("\n🔍 Testing MarketCheck API for My Rock Hill GMC");
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   Source: ${SOURCE}`);
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

            // Save sample VINs
            const sampleVINs = listings.slice(0, 5).map(l => l.vin).filter(Boolean);
            if (sampleVINs.length > 0) {
              console.log(`\n📝 Sample VINs (first 5):`);
              sampleVINs.forEach((vin, i) => console.log(`   ${i + 1}. ${vin}`));
            }

            // Save full response to file
            const outputPath = path.join(__dirname, "..", "temp", "dealer-11042155-inventory.json");
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
            console.log(`\n💾 Full response saved to: ${outputPath}`);

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
            
            // Save raw response even if parsing fails
            const outputPath = path.join(__dirname, "..", "temp", "dealer-11042155-inventory.json");
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, data);
            console.log(`\n💾 Raw response saved to: ${outputPath}`);
            
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

async function runTest() {
  console.log("=".repeat(60));
  console.log("MarketCheck My Rock Hill GMC Test");
  console.log("=".repeat(60));

  try {
    const result = await testRockHillGMC();

    console.log("\n" + "=".repeat(60));
    console.log("Summary");
    console.log("=".repeat(60));
    console.log(`num_found: ${result.numFound}`);
    console.log(`listings.length: ${result.listingsCount}`);
    
    if (result.listingsCount === 0) {
      console.log("\n⚠️  WARNING: Zero listings returned!");
      console.log("   This may indicate:");
      console.log("   1. MarketCheck has no active inventory for this source");
      console.log("   2. API endpoint or parameters are incorrect");
      console.log("   3. Source parameter format is wrong");
    } else {
      console.log(`\n✅ Successfully retrieved ${result.listingsCount} listings`);
    }

    console.log("\n💡 Next Steps:");
    console.log("   1. Review saved JSON file: temp/dealer-11042155-inventory.json");
    console.log("   2. Update user profile with dealer_id=11042155");
    console.log("   3. Run dashboard sync to import inventory");
    console.log("   4. Verify /app/inventory shows Rock Hill GMC vehicles");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTest();


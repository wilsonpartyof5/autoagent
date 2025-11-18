/**
 * Verify sync is ready to test
 */

const dotenv = require("dotenv");
const path = require("path");
const axios = require("axios");

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const API_KEY = process.env.MARKETCHECK_API_KEY;
const BASE_URL = process.env.MARKETCHECK_BASE_URL || "https://api.marketcheck.com";
const DEALER_ID = "10015450";

console.log("🔍 Verifying Sync Configuration");
console.log("===============================\n");

console.log("1. Environment Variables:");
console.log(`   MARKETCHECK_API_KEY: ${API_KEY ? `${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}` : '❌ NOT SET'}`);
console.log(`   MARKETCHECK_BASE_URL: ${BASE_URL}`);
console.log(`   Default Base URL: https://api.marketcheck.com\n`);

if (!API_KEY) {
  console.error("❌ MARKETCHECK_API_KEY is not configured!");
  process.exit(1);
}

console.log("2. Testing MarketCheck API Connection:");
const testUrl = `${BASE_URL}/v2/search/car/active?api_key=${API_KEY}&dealer_id=${DEALER_ID}&pageSize=1`;

axios.get(testUrl)
  .then(response => {
    console.log(`   ✅ API Connection Successful`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Listings Found: ${response.data.num_found || 0}`);
    console.log(`   Sample Listings: ${response.data.listings?.length || 0}\n`);
    
    console.log("3. Ready for Sync Test:");
    console.log(`   - Navigate to http://localhost:3000/app/setup`);
    console.log(`   - Enter Dealer ID: ${DEALER_ID}`);
    console.log(`   - Verify rooftop auto-detects`);
    console.log(`   - Click "Sync MarketCheck Inventory"`);
    console.log(`   - Check server console for sync log`);
    console.log(`   - Navigate to /app/inventory to see vehicles\n`);
    
    console.log("✅ All checks passed! Ready to test sync.");
  })
  .catch(error => {
    console.error(`   ❌ API Connection Failed`);
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    process.exit(1);
  });


/**
 * Drevvy x MarketCheck Dealership Verification Script
 * ------------------------------------------------------
 * Purpose:
 * 1. Check if a dealership exists in MarketCheck.
 * 2. Retrieve mc_dealer_id and confirm inventory availability.
 * 3. Print results and define import readiness.
 *
 * Usage:
 * 1. npm install axios dotenv
 * 2. Create a .env file with MARKETCHECK_API_KEY=your_api_key_here
 * 3. Run: node scripts/verifyDealer.js
 */

const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");

// Load .env from multiple possible locations
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const API_KEY = process.env.MARKETCHECK_API_KEY;

// ✅ STEP 1: Set dealer info to test
const dealerQuery = {
  website: "https://www.myrockhillgmc.com/",
  city: "Rock Hill",
  state: "SC"
};

// ✅ STEP 2: Build URLs
// Note: MarketCheck doesn't have /v2/dealer/search endpoint
// Instead, we search by location and filter by dealer name in results
const searchURL = `https://api.marketcheck.com/v2/search/car/active?api_key=${API_KEY}&location=${encodeURIComponent(
  `${dealerQuery.city}, ${dealerQuery.state}`
)}&radius=50&pageSize=100`;

async function verifyDealer() {
  try {
    console.log("🔍 Searching for dealer in MarketCheck...");
    console.log(`Searching for vehicles in ${dealerQuery.city}, ${dealerQuery.state}`);
    console.log(`Search URL: ${searchURL}`);

    const searchResponse = await axios.get(searchURL, {
      headers: { Accept: "application/json" },
    });

    if (!searchResponse.data.listings || searchResponse.data.listings.length === 0) {
      console.log("❌ No vehicles found in this location. Dealer may not be onboarded or have no active inventory.");
      return;
    }

    // ✅ STEP 3: Find dealer by website URL in search results
    const matchingDealers = new Map();
    // Normalize search website: remove protocol, www, trailing slash, and extract domain
    const searchWebsite = dealerQuery.website.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    const searchDomain = searchWebsite.split('/')[0]; // Extract just the domain
    
    console.log(`🔍 Searching for website: ${searchWebsite} (domain: ${searchDomain})`);
    
    searchResponse.data.listings.forEach(listing => {
      if (listing.dealer) {
        const dealerWebsite = listing.dealer.website?.toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '') || '';
        const dealerDomain = dealerWebsite.split('/')[0];
        
        // Check if dealer website matches (domain match - flexible)
        if (dealerWebsite && (
          dealerWebsite === searchWebsite || 
          dealerDomain === searchDomain ||
          dealerWebsite.includes(searchDomain) || 
          searchDomain.includes(dealerDomain) ||
          dealerDomain.includes(searchWebsite) ||
          searchWebsite.includes(dealerDomain)
        )) {
          const dealerId = listing.dealer.id?.toString();
          if (dealerId && !matchingDealers.has(dealerId)) {
            matchingDealers.set(dealerId, listing.dealer);
          }
        }
      }
    });

    if (matchingDealers.size === 0) {
      console.log(`❌ Dealer with website "${dealerQuery.website}" not found in search results for ${dealerQuery.city}, ${dealerQuery.state}.`);
      console.log("Available dealers in this area:");
      const allDealers = new Map();
      searchResponse.data.listings.forEach(listing => {
        if (listing.dealer && listing.dealer.name) {
          const dealerId = listing.dealer.id?.toString();
          if (dealerId && !allDealers.has(dealerId)) {
            allDealers.set(dealerId, {
              name: listing.dealer.name,
              website: listing.dealer.website || 'N/A',
              id: dealerId
            });
          }
        }
      });
      Array.from(allDealers.values()).slice(0, 10).forEach(dealer => {
        console.log(`  - ${dealer.name} (ID: ${dealer.id}, Website: ${dealer.website})`);
      });
      return;
    }

    // ✅ STEP 3: Display dealer info
    const dealer = Array.from(matchingDealers.values())[0];
    const dealerId = Array.from(matchingDealers.keys())[0];
    console.log("✅ Dealer found in MarketCheck:");
    console.log(`→ Name: ${dealer.name}`);
    console.log(`→ City/State: ${dealer.city || dealerQuery.city}, ${dealer.state || dealerQuery.state}`);
    console.log(`→ MarketCheck Dealer ID: ${dealerId}`);
    console.log("--------------------------------------------------------");

    // ✅ STEP 4: Verify inventory feed
    const inventoryURL = `https://api.marketcheck.com/v2/search/car/active?api_key=${API_KEY}&dealer_id=${dealerId}`;
    console.log("📦 Checking dealer inventory...");
    const inventoryResponse = await axios.get(inventoryURL, {
      headers: { Accept: "application/json" },
    });

    if (inventoryResponse.data.listings && inventoryResponse.data.listings.length > 0) {
      console.log(`✅ Found ${inventoryResponse.data.listings.length} active vehicles.`);
      console.log("Dealer is LIVE and ready to import into Drevvy.");
    } else {
      console.log("⚠️ Dealer record exists but no active inventory found.");
      console.log("Check if dealer feed is paused or recently onboarded.");
    }

    console.log("--------------------------------------------------------");
    console.log("🏁 Summary:");
    console.log(
      `Dealer ${dealer.name} (${dealer.id}) → ${
        inventoryResponse.data.listings?.length > 0
          ? "✅ Eligible for import"
          : "⚠️ Exists but no active feed"
      }`
    );
    console.log("--------------------------------------------------------");

  } catch (err) {
    console.error("🚨 Error checking dealer:", err.response?.data || err.message);
  }
}

verifyDealer();


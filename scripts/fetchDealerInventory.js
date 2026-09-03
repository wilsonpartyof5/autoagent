/**
 * Fetch sample inventory for a MarketCheck dealer
 * Used to get test data for Drevvy sync
 */

const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load .env from multiple possible locations
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const API_KEY = process.env.MARKETCHECK_API_KEY;

// Dealer to test with - let's search for one with active inventory
const SEARCH_LOCATION = "Charlotte, NC"; // Larger metro area more likely to have active dealers
const PAGE_SIZE = 5;

async function fetchDealerInventory() {
  try {
    // First, search for dealers with active inventory in the area
    const searchUrl = `https://api.marketcheck.com/v2/search/car/active?api_key=${API_KEY}&location=${encodeURIComponent(SEARCH_LOCATION)}&radius=25&pageSize=100`;
    
    console.log(`🔍 Searching for dealers with active inventory in ${SEARCH_LOCATION}...`);
    console.log(`Search URL: ${searchUrl}\n`);
    
    const searchResponse = await axios.get(searchUrl, {
      headers: { Accept: "application/json" },
    });

    if (!searchResponse.data.listings || searchResponse.data.listings.length === 0) {
      console.log("❌ No listings found in this area.");
      return;
    }

    // Find a dealer with multiple listings
    const dealerMap = new Map();
    searchResponse.data.listings.forEach(listing => {
      if (listing.dealer && listing.dealer.id) {
        const dealerId = listing.dealer.id.toString();
        if (!dealerMap.has(dealerId)) {
          dealerMap.set(dealerId, {
            id: dealerId,
            name: listing.dealer.name,
            listings: []
          });
        }
        dealerMap.get(dealerId).listings.push(listing);
      }
    });

    // Find dealer with most listings
    let selectedDealer = null;
    let maxListings = 0;
    dealerMap.forEach((dealer, id) => {
      if (dealer.listings.length > maxListings) {
        maxListings = dealer.listings.length;
        selectedDealer = dealer;
      }
    });

    if (!selectedDealer) {
      console.log("❌ No dealer found with active inventory.");
      return;
    }

    console.log(`✅ Found dealer: ${selectedDealer.name} (ID: ${selectedDealer.id})`);
    console.log(`   Total listings in search: ${selectedDealer.listings.length}\n`);

    // Use the listings we already found (limit to PAGE_SIZE)
    const listings = selectedDealer.listings.slice(0, PAGE_SIZE);
    
    console.log(`📦 Using ${listings.length} listings from search results for ${selectedDealer.name}...\n`);

    if (listings.length === 0) {
      console.log("❌ No listings available for this dealer.");
      return;
    }

    console.log(`\n✅ Found ${listings.length} listings\n`);
    
    // Display summary
    listings.forEach((listing, index) => {
      console.log(`${index + 1}. ${listing.year} ${listing.make} ${listing.model}`);
      console.log(`   VIN: ${listing.vin}`);
      console.log(`   Price: $${listing.price || 'N/A'}`);
      console.log(`   Mileage: ${listing.miles || 'N/A'}`);
      console.log(`   Dealer: ${listing.dealer?.name || 'N/A'}`);
      console.log("");
    });

    // Save dealer info
    const dealerInfo = {
      id: selectedDealer.id,
      name: selectedDealer.name,
      city: listings[0]?.dealer?.city || 'Unknown',
      state: listings[0]?.dealer?.state || 'Unknown',
      website: listings[0]?.dealer?.website || null,
    };

    // Save raw response to file (simulate API response structure)
    const rawResponse = {
      listings: listings,
      num_found: listings.length,
      page: 1,
      page_size: PAGE_SIZE
    };

    const outputFile = path.join(__dirname, "..", "temp", `dealer-${selectedDealer.id}-inventory.json`);
    const outputDir = path.dirname(outputFile);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(rawResponse, null, 2));
    console.log(`📁 Raw response saved to: ${outputFile}`);
    
    // Save dealer info
    const dealerInfoFile = path.join(__dirname, "..", "temp", `dealer-${selectedDealer.id}-info.json`);
    fs.writeFileSync(dealerInfoFile, JSON.stringify(dealerInfo, null, 2));
    console.log(`📁 Dealer info saved to: ${dealerInfoFile}`);
    
    // Also save normalized listings
    const normalizedFile = path.join(__dirname, "..", "temp", `dealer-${selectedDealer.id}-listings-normalized.json`);
    const normalized = listings.map(listing => ({
      vin: listing.vin,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price,
      miles: listing.miles,
      dealer_id: listing.dealer?.id,
      dealer_name: listing.dealer?.name,
      exterior_color: listing.exterior_color,
      interior_color: listing.interior_color,
      fuel_type: listing.fuel_type,
      transmission: listing.transmission,
      drivetrain: listing.drivetrain,
      body_type: listing.body_type,
      engine: listing.engine,
      stock_no: listing.stock_no,
      description: listing.description,
      images: listing.media?.photo_links || [],
    }));
    
    fs.writeFileSync(normalizedFile, JSON.stringify(normalized, null, 2));
    console.log(`📁 Normalized listings saved to: ${normalizedFile}`);
    
    console.log(`\n✅ Dealer selected for sync test:`);
    console.log(`   Name: ${dealerInfo.name}`);
    console.log(`   ID: ${dealerInfo.id}`);
    console.log(`   Location: ${dealerInfo.city}, ${dealerInfo.state}`);
    console.log(`   Website: ${dealerInfo.website || 'N/A'}`);
    console.log(`   Listings fetched: ${listings.length}`);
    
    return { dealerInfo, listings, rawData: rawResponse };

  } catch (err) {
    console.error("🚨 Error fetching dealer inventory:", err.response?.data || err.message);
    throw err;
  }
}

fetchDealerInventory();


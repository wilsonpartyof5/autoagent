/**
 * Diagnostic script to check why inventory is not showing up
 * Checks: vehicle count, availability_status, active dealership, sync status
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

// Try loading from dealer-dashboard .env.local
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL not found");
  console.log("   Make sure apps/dealer-dashboard/.env.local exists with Supabase credentials");
  process.exit(1);
}

// Use service role key if available (bypasses RLS), otherwise use anon key
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
);

async function checkInventory() {
  console.log("🔍 Inventory Diagnostic Check");
  console.log("============================\n");

  // Check 1: Total vehicles in uvs_vehicles
  console.log("1️⃣  Checking total vehicles in database...");
  const { count: totalCount, error: totalError } = await supabase
    .from('uvs_vehicles')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error(`   ❌ Error: ${totalError.message}`);
    console.log(`   ⚠️  This might be an RLS (Row Level Security) issue.`);
    console.log(`   💡 Try running this query in Supabase SQL Editor:\n`);
    console.log(`      SELECT COUNT(*) FROM uvs_vehicles;\n`);
  } else {
    console.log(`   ✅ Total vehicles in database: ${totalCount || 0}\n`);
  }

  // Check 2: Available vehicles
  console.log("2️⃣  Checking available vehicles...");
  const { count: availableCount, error: availableError } = await supabase
    .from('uvs_vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('availability_status', 'available');

  if (availableError) {
    console.error(`   ❌ Error: ${availableError.message}\n`);
  } else {
    console.log(`   ✅ Available vehicles: ${availableCount || 0}\n`);
    
    if ((availableCount || 0) === 0 && (totalCount || 0) > 0) {
      console.log(`   ⚠️  WARNING: You have ${totalCount} vehicles but none are marked as 'available'`);
      console.log(`   💡 Check availability_status values in the database\n`);
    }
  }

  // Check 3: Availability status breakdown
  console.log("3️⃣  Checking availability_status breakdown...");
  const { data: statusData, error: statusError } = await supabase
    .from('uvs_vehicles')
    .select('availability_status')
    .limit(1000); // Sample first 1000

  if (statusError) {
    console.error(`   ❌ Error: ${statusError.message}\n`);
  } else {
    const statusCounts = {};
    (statusData || []).forEach(row => {
      const status = row.availability_status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log("   Status breakdown:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      const icon = status === 'available' ? '✅' : '⚠️';
      console.log(`   ${icon} ${status || '(null)'}: ${count}`);
    });
    console.log("");
  }

  // Check 4: Sample vehicles
  console.log("4️⃣  Checking sample vehicles...");
  const { data: sampleVehicles, error: sampleError } = await supabase
    .from('uvs_vehicles')
    .select('id, vin, year, make, model, price, dealer_name, availability_status, last_synced_at, sync_status, sync_error')
    .order('last_synced_at', { ascending: false })
    .limit(5);

  if (sampleError) {
    console.error(`   ❌ Error: ${sampleError.message}\n`);
  } else if (!sampleVehicles || sampleVehicles.length === 0) {
    console.log("   ⚠️  No vehicles found in database");
    console.log("   💡 You may need to sync inventory first via the Setup page\n");
  } else {
    console.log(`   Found ${sampleVehicles.length} recent vehicles:\n`);
    sampleVehicles.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.year || 'N/A'} ${v.make || 'N/A'} ${v.model || 'N/A'}`);
      console.log(`      ID: ${v.id}`);
      console.log(`      VIN: ${v.vin || 'N/A'}`);
      console.log(`      Price: ${v.price ? '$' + v.price.toLocaleString() : 'N/A'}`);
      console.log(`      Dealer: ${v.dealer_name || 'N/A'}`);
      console.log(`      Status: ${v.availability_status || '(null)'} ${v.availability_status === 'available' ? '✅' : '⚠️'}`);
      console.log(`      Sync: ${v.sync_status || 'N/A'} (${v.last_synced_at ? new Date(v.last_synced_at).toLocaleString() : 'N/A'})`);
      if (v.sync_error) {
        console.log(`      ⚠️  Sync Error: ${v.sync_error}`);
      }
      console.log("");
    });
  }

  // Check 5: Data sources
  console.log("5️⃣  Checking data sources...");
  const { data: sourceData, error: sourceError } = await supabase
    .from('uvs_vehicles')
    .select('data_source')
    .limit(1000);

  if (sourceError) {
    console.error(`   ❌ Error: ${sourceError.message}\n`);
  } else {
    const sourceCounts = {};
    (sourceData || []).forEach(row => {
      const source = row.data_source || '(null)';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    console.log("   Data sources:");
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`   • ${source}: ${count}`);
    });
    console.log("");
  }

  // Check 6: Dealership info from vehicles
  console.log("6️⃣  Checking dealership information from vehicles...");
  const { data: dealerData, error: dealerError } = await supabase
    .from('uvs_vehicles')
    .select('dealer_id, dealer_name')
    .limit(100);

  if (dealerError) {
    console.error(`   ❌ Error: ${dealerError.message}\n`);
  } else {
    const dealerInfo = {};
    (dealerData || []).forEach(row => {
      const dealerId = row.dealer_id || '(no dealer_id)';
      const dealerName = row.dealer_name || '(no dealer_name)';
      if (!dealerInfo[dealerId]) {
        dealerInfo[dealerId] = { name: dealerName, count: 0 };
      }
      dealerInfo[dealerId].count++;
    });
    
    console.log("   Dealerships found in vehicles:");
    Object.entries(dealerInfo).forEach(([dealerId, info]) => {
      console.log(`   • Dealer ID: ${dealerId}`);
      console.log(`     Name: ${info.name}`);
      console.log(`     Vehicle count: ${info.count}`);
    });
    console.log("");
  }

  // Check for any vehicles with different availability_status
  console.log("📊 Detailed Status Breakdown:");
  console.log("─".repeat(60));
  const { data: allStatusData, error: allStatusError } = await supabase
    .from('uvs_vehicles')
    .select('availability_status, sync_status, dealer_id, data_source')
    .limit(1000);

  if (!allStatusError && allStatusData) {
    const byDealer = {};
    allStatusData.forEach(row => {
      const dealerId = row.dealer_id || 'unknown';
      if (!byDealer[dealerId]) {
        byDealer[dealerId] = {
          available: 0,
          other: 0,
          total: 0,
        };
      }
      byDealer[dealerId].total++;
      if (row.availability_status === 'available') {
        byDealer[dealerId].available++;
      } else {
        byDealer[dealerId].other++;
      }
    });

    Object.entries(byDealer).forEach(([dealerId, counts]) => {
      console.log(`  Dealer ID: ${dealerId}`);
      console.log(`    Total vehicles: ${counts.total}`);
      console.log(`    Available: ${counts.available}`);
      console.log(`    Other status: ${counts.other}`);
    });
  }
  console.log('');

  // Summary and recommendations
  console.log("📋 Summary & Recommendations");
  console.log("============================\n");

  if ((totalCount || 0) === 0) {
    console.log("❌ No vehicles found in database.");
    console.log("   → Go to Setup page and sync inventory from MarketCheck\n");
  } else if ((availableCount || 0) === 0) {
    console.log("⚠️  Vehicles exist but none are available.");
    console.log("   → Check why vehicles are marked as unavailable");
    console.log("   → In Supabase SQL Editor, run:");
    console.log("     UPDATE uvs_vehicles SET availability_status = 'available' WHERE availability_status IS NULL;\n");
  } else {
    console.log(`✅ Found ${availableCount} available vehicles in database`);
    console.log("");
    console.log("🔍 If inventory is not showing in the dashboard:");
    console.log("");
    console.log("   1️⃣  **Check Active Dealership (MOST LIKELY ISSUE)**");
    console.log("      → Go to Settings in the dashboard");
    console.log("      → Ensure a dealership is set up and marked as 'Active'");
    console.log("      → The inventory page requires an active dealership to display vehicles");
    console.log("");
    console.log("   2️⃣  **Verify Browser Console**");
    console.log("      → Open browser DevTools (F12)");
    console.log("      → Check Console tab for errors");
    console.log("      → Check Network tab for failed API calls");
    console.log("");
    console.log("   3️⃣  **Check Authentication**");
    console.log("      → Ensure you're logged in");
    console.log("      → Try refreshing the page");
    console.log("");
  }
}

checkInventory().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});


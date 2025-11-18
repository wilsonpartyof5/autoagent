/**
 * Query Supabase inventory_vehicles table
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEALER_ID = "10015450";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Supabase credentials not found");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function queryInventory() {
  console.log("🔍 Querying inventory_vehicles table");
  console.log(`   Dealer ID: ${DEALER_ID}\n`);

  // Note: This will only work if RLS allows anonymous reads
  // Otherwise, we need to use service role key or authenticated user
  const { data, error } = await supabase
    .from("inventory_vehicles")
    .select("vin, year, make, model, dealer_id, dealer_name, created_at")
    .eq("dealer_id", DEALER_ID)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Query failed:", error);
    console.log("\n📋 Alternative: Run this query in Supabase SQL Editor:");
    console.log(`SELECT vin, year, make, model FROM inventory_vehicles WHERE dealer_id='${DEALER_ID}';`);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} vehicles\n`);
  
  if (data && data.length > 0) {
    console.log("Vehicles:");
    data.forEach((vehicle, index) => {
      console.log(`${index + 1}. ${vehicle.year || 'N/A'} ${vehicle.make || 'N/A'} ${vehicle.model || 'N/A'}`);
      console.log(`   VIN: ${vehicle.vin || 'N/A'}`);
      console.log(`   Dealer: ${vehicle.dealer_name || 'N/A'}`);
      console.log(`   Created: ${vehicle.created_at || 'N/A'}`);
      console.log("");
    });
  } else {
    console.log("No vehicles found for this dealer ID.");
    console.log("\n📋 Run this query in Supabase SQL Editor to check:");
    console.log(`SELECT vin, year, make, model FROM inventory_vehicles WHERE dealer_id='${DEALER_ID}';`);
  }
}

queryInventory().catch(console.error);


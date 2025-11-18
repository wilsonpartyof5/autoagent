/**
 * Verify Rock Hill GMC inventory after sync
 * Queries Supabase to confirm vehicles were imported
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DEALER_ID = "11042155";

if (!SUPABASE_URL) {
  console.error("❌ Supabase URL not found");
  process.exit(1);
}

const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
if (!supabaseKey) {
  console.error("❌ Supabase key not found");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, supabaseKey);

async function verifyInventory() {
  console.log("=".repeat(60));
  console.log("Rock Hill GMC Inventory Verification");
  console.log("=".repeat(60));
  console.log(`Dealer ID: ${DEALER_ID}\n`);

  // Get all users
  let userIds = [];
  if (SUPABASE_SERVICE_KEY) {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("❌ Error fetching users:", error.message);
      return;
    }
    if (users && users.users.length > 0) {
      userIds = users.users.map(u => u.id);
      console.log(`✅ Found ${userIds.length} user(s)\n`);
    }
  }

  if (userIds.length === 0) {
    console.log("⚠️  No users found");
    console.log("   Please sign in at http://localhost:3000/auth first\n");
    return;
  }

  // Check inventory for each user
  for (const userId of userIds) {
    console.log(`\n📊 Checking inventory for user: ${userId.substring(0, 8)}...\n`);

    // Count vehicles
    const { data: vehicles, error } = await supabase
      .from('inventory_vehicles')
      .select('vin, year, make, model, condition, price, miles, dealer_id, data_source, created_at')
      .eq('user_id', userId)
      .eq('dealer_id', DEALER_ID)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("❌ Error querying inventory:", error.message);
      continue;
    }

    if (!vehicles || vehicles.length === 0) {
      console.log("⚠️  No vehicles found for dealer 11042155");
      console.log("   Sync may not have completed yet\n");
      continue;
    }

    // Summary statistics
    const marketcheckCount = vehicles.filter(v => v.data_source === 'marketcheck-api').length;
    const makes = [...new Set(vehicles.map(v => v.make))];
    const conditions = [...new Set(vehicles.map(v => v.condition))];
    const years = vehicles.map(v => v.year).filter(Boolean);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    console.log(`✅ Found ${vehicles.length} vehicles for Rock Hill GMC\n`);
    console.log(`📊 Summary:`);
    console.log(`   Total vehicles: ${vehicles.length}`);
    console.log(`   From MarketCheck: ${marketcheckCount}`);
    console.log(`   Makes: ${makes.join(', ')}`);
    console.log(`   Conditions: ${conditions.join(', ')}`);
    console.log(`   Year range: ${minYear}-${maxYear}\n`);

    // Sample vehicles
    console.log(`📋 Sample vehicles (first 10):\n`);
    vehicles.slice(0, 10).forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.year} ${v.make} ${v.model}`);
      console.log(`      VIN: ${v.vin}`);
      console.log(`      Condition: ${v.condition}, Price: $${v.price?.toLocaleString() || 'N/A'}, Miles: ${v.miles?.toLocaleString() || 'N/A'}`);
      console.log(`      Data source: ${v.data_source}`);
      console.log(`      Created: ${new Date(v.created_at).toLocaleString()}\n`);
    });

    if (vehicles.length > 10) {
      console.log(`   ... and ${vehicles.length - 10} more vehicles\n`);
    }

    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('marketcheck_dealer_id, marketcheck_zip, inventory_connected')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      console.log(`👤 Profile settings:`);
      console.log(`   MarketCheck Dealer ID: ${profile.marketcheck_dealer_id}`);
      console.log(`   ZIP: ${profile.marketcheck_zip}`);
      console.log(`   Inventory Connected: ${profile.inventory_connected}\n`);
    }

    console.log("=".repeat(60));
    console.log("✅ Verification complete!");
    console.log("=".repeat(60));
  }
}

verifyInventory().catch(console.error);


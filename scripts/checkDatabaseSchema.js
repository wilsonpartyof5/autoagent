/**
 * Check if database schema is set up correctly
 * Verifies tables and columns exist
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

async function checkSchema() {
  console.log("=".repeat(60));
  console.log("Database Schema Check");
  console.log("=".repeat(60));
  console.log("");

  // Check profiles table
  console.log("📋 Checking profiles table...");
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('marketcheck_dealer_id, marketcheck_zip')
      .limit(1);

    if (error) {
      if (error.code === '42703') {
        console.log("❌ Column 'marketcheck_dealer_id' does not exist");
        console.log("   Run migration: 20250220_alter_profiles_marketcheck.sql");
      } else if (error.code === '42P01') {
        console.log("❌ Table 'profiles' does not exist");
        console.log("   Run migration: 20250219_add_profiles_table.sql");
      } else {
        console.log(`❌ Error: ${error.message} (code: ${error.code})`);
      }
    } else {
      console.log("✅ profiles table exists with marketcheck columns");
    }
  } catch (e) {
    console.log(`❌ Error checking profiles: ${e.message}`);
  }

  console.log("");

  // Check inventory_vehicles table
  console.log("📋 Checking inventory_vehicles table...");
  try {
    const { data, error } = await supabase
      .from('inventory_vehicles')
      .select('vin, year, make, model, dealer_id, data_source')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        console.log("❌ Table 'inventory_vehicles' not found in schema cache");
        console.log("   Run migrations:");
        console.log("   1. 20250220_create_inventory_vehicles.sql");
        console.log("   2. 20250221_alter_inventory_vehicles_metafields.sql");
        console.log("");
        console.log("   Or refresh Supabase schema cache in dashboard");
      } else if (error.code === '42P01') {
        console.log("❌ Table 'inventory_vehicles' does not exist");
        console.log("   Run migration: 20250220_create_inventory_vehicles.sql");
      } else {
        console.log(`❌ Error: ${error.message} (code: ${error.code})`);
      }
    } else {
      console.log("✅ inventory_vehicles table exists");
    }
  } catch (e) {
    console.log(`❌ Error checking inventory_vehicles: ${e.message}`);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("Next Steps:");
  console.log("=".repeat(60));
  console.log("");
  console.log("1. Run migrations in Supabase SQL Editor:");
  console.log("   - apps/dealer-dashboard/supabase/migrations/20250219_add_profiles_table.sql");
  console.log("   - apps/dealer-dashboard/supabase/migrations/20250220_alter_profiles_marketcheck.sql");
  console.log("   - apps/dealer-dashboard/supabase/migrations/20250220_create_inventory_vehicles.sql");
  console.log("   - apps/dealer-dashboard/supabase/migrations/20250221_alter_inventory_vehicles_metafields.sql");
  console.log("");
  console.log("2. If schema cache error, refresh cache in Supabase dashboard");
  console.log("   (Settings → API → Refresh schema cache)");
  console.log("");
  console.log("3. Restart dashboard server after migrations");
  console.log("");
}

checkSchema().catch(console.error);


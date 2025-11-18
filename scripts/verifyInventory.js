/**
 * Verify inventory after sync
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const DEALER_ID = "10015450";

async function verifyInventory() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Supabase credentials not found");
    return;
  }

  console.log("🔍 Verifying inventory in Supabase...");
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Dealer ID: ${DEALER_ID}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Note: This requires RLS to allow anonymous reads or a service role key
  // For now, just document the query needed
  console.log("📋 To verify inventory, run this query in Supabase SQL Editor:");
  console.log(`
SELECT 
  vin,
  year,
  make,
  model,
  trim,
  condition,
  miles,
  price,
  dealer_name,
  dealer_city,
  dealer_state,
  dealer_id,
  sync_status,
  data_source,
  created_at
FROM inventory_vehicles
WHERE dealer_id = '${DEALER_ID}'
ORDER BY created_at DESC;
  `);

  console.log("\nOr check the dashboard at: http://localhost:3000/app/inventory");
}

verifyInventory().catch(console.error);


/**
 * Complete Rock Hill GMC onboarding flow
 * 1. Update profile with dealer_id=11042155, ZIP=29730
 * 2. Run sync via API route
 * 3. Verify inventory in database
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DASHBOARD_INGEST_TOKEN = process.env.DASHBOARD_INGEST_TOKEN;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

const DEALER_ID = "11042155";
const ZIP = "29730";

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

async function getUserId() {
  if (SUPABASE_SERVICE_KEY) {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("❌ Error fetching users:", error.message);
      return null;
    }
    if (users && users.users.length > 0) {
      return users.users[0].id;
    }
  }
  return null;
}

async function updateProfile(userId) {
  console.log("\n📝 Updating profile...");
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   ZIP: ${ZIP}\n`);

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      marketcheck_dealer_id: DEALER_ID,
      marketcheck_zip: ZIP,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error("❌ Error updating profile:", error.message);
    console.log("\n💡 Manual SQL Update:");
    console.log(`UPDATE profiles`);
    console.log(`SET marketcheck_dealer_id = '${DEALER_ID}',`);
    console.log(`    marketcheck_zip = '${ZIP}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE id = '${userId}';\n`);
    return false;
  }

  console.log("✅ Profile updated successfully\n");
  return true;
}

async function triggerSync() {
  if (!DASHBOARD_INGEST_TOKEN) {
    console.log("⚠️  DASHBOARD_INGEST_TOKEN not found");
    console.log("   Sync must be triggered manually via dashboard UI\n");
    return null;
  }

  console.log("🚀 Triggering MarketCheck sync...\n");

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/inventory/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHBOARD_INGEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealerId: DEALER_ID,
        zip: ZIP,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Sync triggered successfully!");
      console.log(`   Imported: ${data.imported || 0} vehicles\n`);
      return data;
    } else {
      console.error("❌ Sync failed:");
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${JSON.stringify(data, null, 2)}\n`);
      return null;
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
    console.log("\n💡 Make sure the dashboard server is running:");
    console.log("   cd apps/dealer-dashboard && npm run dev\n");
    return null;
  }
}

async function verifyInventory(userId) {
  console.log("🔍 Verifying inventory...\n");

  const { data: vehicles, error } = await supabase
    .from('inventory_vehicles')
    .select('vin, year, make, model, condition, price, miles, dealer_id, data_source, created_at')
    .eq('user_id', userId)
    .eq('dealer_id', DEALER_ID)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ Error querying inventory:", error.message);
    return null;
  }

  if (!vehicles || vehicles.length === 0) {
    console.log("⚠️  No vehicles found for dealer 11042155");
    console.log("   Sync may not have completed yet\n");
    return null;
  }

  console.log(`✅ Found ${vehicles.length} vehicles:\n`);
  vehicles.slice(0, 5).forEach((v, i) => {
    console.log(`   ${i + 1}. ${v.year} ${v.make} ${v.model} (VIN: ${v.vin})`);
    console.log(`      Condition: ${v.condition}, Price: $${v.price}, Miles: ${v.miles}`);
  });
  if (vehicles.length > 5) {
    console.log(`   ... and ${vehicles.length - 5} more\n`);
  }

  // Count by data source
  const marketcheckCount = vehicles.filter(v => v.data_source === 'marketcheck-api').length;
  console.log(`📊 Summary:`);
  console.log(`   Total vehicles: ${vehicles.length}`);
  console.log(`   From MarketCheck: ${marketcheckCount}`);
  console.log(`   Dealer ID: ${DEALER_ID}\n`);

  return vehicles;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Rock Hill GMC Onboarding Flow");
  console.log("=".repeat(60));

  // Step 1: Get user ID
  const userId = await getUserId();
  if (!userId) {
    console.log("⚠️  Cannot determine user_id automatically");
    console.log("   Please sign in at http://localhost:3000/auth");
    console.log("   Then run this SQL to update profile:\n");
    console.log(`UPDATE profiles`);
    console.log(`SET marketcheck_dealer_id = '${DEALER_ID}',`);
    console.log(`    marketcheck_zip = '${ZIP}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE id = (SELECT id FROM auth.users LIMIT 1);\n`);
    console.log("   Then trigger sync at http://localhost:3000/app/setup\n");
    process.exit(1);
  }

  console.log(`✅ Found user: ${userId}\n`);

  // Step 2: Update profile
  const profileUpdated = await updateProfile(userId);
  if (!profileUpdated && !SUPABASE_SERVICE_KEY) {
    console.log("⚠️  Profile update requires SUPABASE_SERVICE_ROLE_KEY");
    console.log("   Please update profile manually via dashboard or SQL\n");
  }

  // Step 3: Trigger sync
  const syncResult = await triggerSync();

  // Step 4: Verify inventory
  if (syncResult || DASHBOARD_INGEST_TOKEN) {
    console.log("⏳ Waiting 5 seconds for sync to complete...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
    await verifyInventory(userId);
  } else {
    console.log("💡 To complete sync:");
    console.log("   1. Sign in at http://localhost:3000/auth");
    console.log("   2. Navigate to http://localhost:3000/app/setup");
    console.log("   3. Click 'Sync MarketCheck Inventory'");
    console.log("   4. Watch server logs for [syncMarketCheckInventory] entries\n");
  }

  console.log("=".repeat(60));
  console.log("Onboarding flow complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);


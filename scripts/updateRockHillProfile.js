/**
 * Update user profile with My Rock Hill GMC dealer settings
 * Requires SUPABASE_SERVICE_ROLE_KEY or manual SQL execution
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

const DEALER_ID = "11042155";
const ZIP = "29730"; // Rock Hill, SC ZIP code
const DEALER_NAME = "My Rock Hill GMC";

async function updateProfile() {
  const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    console.error("❌ Supabase key not found");
    console.log("\n📝 Manual SQL Update Required:");
    console.log("   Run this SQL in Supabase SQL Editor:\n");
    console.log(`UPDATE profiles`);
    console.log(`SET marketcheck_dealer_id = '${DEALER_ID}',`);
    console.log(`    marketcheck_zip = '${ZIP}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE id = (SELECT id FROM auth.users LIMIT 1);`);
    console.log("\n   Or replace the WHERE clause with your specific user_id.\n");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, supabaseKey);

  // Get user ID
  let userId = null;
  if (SUPABASE_SERVICE_KEY) {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error("❌ Error fetching users:", usersError.message);
      process.exit(1);
    }
    if (users && users.users.length > 0) {
      userId = users.users[0].id;
      console.log(`✅ Found user: ${userId}\n`);
    }
  }

  if (!userId) {
    console.log("⚠️  Cannot determine user_id automatically");
    console.log("   Please run the SQL manually:\n");
    console.log(`UPDATE profiles`);
    console.log(`SET marketcheck_dealer_id = '${DEALER_ID}',`);
    console.log(`    marketcheck_zip = '${ZIP}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE id = (SELECT id FROM auth.users LIMIT 1);\n`);
    return;
  }

  // Update profile
  console.log("📝 Updating profile...");
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
    console.log("\n📝 Manual SQL Update:");
    console.log(`UPDATE profiles`);
    console.log(`SET marketcheck_dealer_id = '${DEALER_ID}',`);
    console.log(`    marketcheck_zip = '${ZIP}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE id = '${userId}';\n`);
    process.exit(1);
  }

  console.log("✅ Profile updated successfully!");
  console.log(`   Dealer ID: ${DEALER_ID}`);
  console.log(`   ZIP: ${ZIP}`);
  console.log(`   Dealer: ${DEALER_NAME}\n`);
  console.log("💡 Next Steps:");
  console.log("   1. Navigate to http://localhost:3000/app/setup");
  console.log("   2. Click 'Sync Inventory' button");
  console.log("   3. Verify vehicles appear in /app/inventory\n");
}

updateProfile().catch(console.error);


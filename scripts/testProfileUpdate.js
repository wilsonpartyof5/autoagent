/**
 * Test profile update to diagnose the error
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("🧪 Testing Profile Update");
console.log("=========================\n");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Supabase credentials not found");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

console.log("1. Supabase Configuration:");
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`);

console.log("2. Testing Profile Update:");
console.log("   Note: This requires authentication, so it will likely fail");
console.log("   The actual error will appear in server logs when sync runs\n`");

console.log("📋 To capture the error:");
console.log("   1. Navigate to http://localhost:3000/app/setup");
console.log("   2. Enter dealer ID: 10015450");
console.log("   3. Click 'Sync MarketCheck Inventory'");
console.log("   4. Check server console for detailed error logs");
console.log("   5. Look for '[profiles]' and '[syncMarketCheckInventory]' log entries\n");

console.log("Expected log entries:");
console.log("   [profiles] Attempting to update profile: {...}");
console.log("   [profiles] Profile update result: {...}");
console.log("   [profiles] failed to update profile: {...}");
console.log("   [syncMarketCheckInventory] Profile update failed: {...}");


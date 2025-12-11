#!/usr/bin/env node

/**
 * Debug script to test the exact inventory query used by the inventory page
 * This will help identify why vehicles aren't showing up
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEMO_EMAIL = 'demo@autoagent.com';

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found');
  process.exit(1);
}

// Test with both service role (bypasses RLS) and anon key (simulates user access)
async function debugInventoryQuery() {
  console.log('🔍 Debugging Inventory Query\n');
  console.log('='.repeat(60));

  // First, get demo user's auth token (we'll use service role to simulate)
  const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Find demo user
  const { data: users } = await serviceSupabase.auth.admin.listUsers();
  const demoUser = users.users.find(u => u.email === DEMO_EMAIL);
  
  if (!demoUser) {
    console.error(`❌ Demo user not found: ${DEMO_EMAIL}`);
    process.exit(1);
  }

  console.log(`\n1️⃣  Testing with Service Role (bypasses RLS):\n`);
  await testQuery(serviceSupabase, 'Service Role');

  if (SUPABASE_ANON_KEY) {
    console.log(`\n2️⃣  Testing with Anon Key (simulates browser access):\n`);
    const anonSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Note: Anon key queries will be filtered by RLS, so might return empty
    await testQuery(anonSupabase, 'Anon Key');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 If service role works but anon key doesn\'t, RLS policies might be blocking');
  console.log('💡 If both return empty, the query itself might be the issue\n');
}

async function testQuery(supabase, label) {
  console.log(`   ${label}:`);
  
  // Exact query from inventory page
  const filters = {
    availabilityStatus: 'available',
  };

  let query = supabase.from('uvs_vehicles').select('uvs_data', { count: 'exact' });
  
  // Apply availability filter
  if (filters.availabilityStatus) {
    query = query.eq('availability_status', filters.availabilityStatus);
  } else {
    query = query.eq('availability_status', 'available');
  }
  
  // Apply pagination (same as inventory page)
  const limit = 20;
  const offset = 0;
  query = query.range(offset, offset + limit - 1);
  
  // Order by most recently synced
  query = query.order('last_synced_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Details: ${error.details}`);
    return;
  }

  console.log(`   ✅ Query succeeded`);
  console.log(`   Total count: ${count || 0}`);
  console.log(`   Returned: ${data?.length || 0} vehicles`);
  
  if (data && data.length > 0) {
    console.log(`   \n   Sample vehicles:`);
    data.slice(0, 3).forEach((row, i) => {
      const vehicle = row.uvs_data;
      console.log(`   ${i + 1}. ${vehicle.baseIdentity?.year || 'N/A'} ${vehicle.baseIdentity?.make || 'N/A'} ${vehicle.baseIdentity?.model || 'N/A'}`);
      console.log(`      ID: ${vehicle.id}`);
      console.log(`      VIN: ${vehicle.baseIdentity?.vin || 'N/A'}`);
      console.log(`      Dealer: ${vehicle.location?.dealer?.name || 'N/A'}`);
    });
  } else {
    console.log(`   ⚠️  No vehicles returned!`);
  }
}

debugInventoryQuery().catch((error) => {
  console.error('\n❌ Debug failed:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
});


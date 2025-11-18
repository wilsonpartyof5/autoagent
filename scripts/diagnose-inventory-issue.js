#!/usr/bin/env node

/**
 * Diagnostic script to check why Rock Hill GMC inventory isn't showing
 * Checks:
 * 1. If dealership_id column exists
 * 2. If inventory has dealership_id set
 * 3. If active dealership exists
 * 4. If inventory is linked to the active dealership
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../apps/dealer-dashboard/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 Diagnosing inventory display issue...\n');

  // 1. Check if dealership_id column exists
  console.log('1️⃣ Checking if dealership_id column exists...');
  try {
    const { data, error } = await supabase
      .from('inventory_vehicles')
      .select('dealership_id')
      .limit(1);
    
    if (error && error.code === '42703') {
      console.log('   ❌ dealership_id column does NOT exist');
      console.log('   💡 Solution: Run migrations from scripts/run-all-migrations.sql\n');
      return;
    } else if (error) {
      console.log('   ⚠️  Error checking column:', error.message);
    } else {
      console.log('   ✅ dealership_id column exists\n');
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message);
    return;
  }

  // 2. Check for Rock Hill GMC inventory
  console.log('2️⃣ Checking for Rock Hill GMC inventory...');
  const { data: inventory, error: invError } = await supabase
    .from('inventory_vehicles')
    .select('id, vin, year, make, model, user_id, dealership_id, dealer_id')
    .eq('dealer_id', '11042155')
    .limit(10);

  if (invError) {
    console.log('   ❌ Error querying inventory:', invError.message);
    return;
  }

  if (!inventory || inventory.length === 0) {
    console.log('   ⚠️  No Rock Hill GMC inventory found');
    console.log('   💡 Solution: Run sync from /app/setup\n');
    return;
  }

  console.log(`   ✅ Found ${inventory.length} Rock Hill GMC vehicles`);
  const withDealershipId = inventory.filter(v => v.dealership_id);
  const withoutDealershipId = inventory.filter(v => !v.dealership_id);
  
  console.log(`   - ${withDealershipId.length} with dealership_id`);
  console.log(`   - ${withoutDealershipId.length} without dealership_id\n`);

  if (withoutDealershipId.length > 0) {
    console.log('   ⚠️  Some inventory is missing dealership_id');
    console.log('   💡 Solution: Run backfill migration or manually link inventory\n');
  }

  // 3. Check for users and their dealerships
  console.log('3️⃣ Checking user dealerships...');
  const userIds = [...new Set(inventory.map(v => v.user_id))];
  
  for (const userId of userIds) {
    console.log(`\n   User: ${userId.substring(0, 8)}...`);
    
    // Check dealerships
    const { data: dealerships, error: dError } = await supabase
      .from('user_dealerships')
      .select('dealership_id, dealerships(*)')
      .eq('user_id', userId);

    if (dError) {
      console.log(`   ❌ Error: ${dError.message}`);
      continue;
    }

    if (!dealerships || dealerships.length === 0) {
      console.log('   ⚠️  No dealerships found for this user');
      console.log('   💡 Solution: Run backfill migration\n');
      continue;
    }

    console.log(`   ✅ Found ${dealerships.length} dealership(s)`);
    dealerships.forEach(d => {
      const dInfo = d.dealerships;
      console.log(`      - ${dInfo?.name || 'Unknown'} (${d.dealership_id})`);
    });

    // Check active dealership
    const { data: prefs, error: pError } = await supabase
      .from('user_preferences')
      .select('active_dealership_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (pError) {
      console.log(`   ⚠️  Error checking preferences: ${pError.message}`);
    } else if (!prefs || !prefs.active_dealership_id) {
      console.log('   ⚠️  No active dealership set');
      console.log('   💡 Solution: Set active dealership or run backfill migration\n');
    } else {
      console.log(`   ✅ Active dealership: ${prefs.active_dealership_id}`);
      
      // Check if inventory is linked to active dealership
      const { data: linkedInventory, error: liError } = await supabase
        .from('inventory_vehicles')
        .select('id')
        .eq('user_id', userId)
        .eq('dealership_id', prefs.active_dealership_id)
        .eq('dealer_id', '11042155');

      if (liError) {
        console.log(`   ⚠️  Error checking linked inventory: ${liError.message}`);
      } else {
        console.log(`   ✅ ${linkedInventory?.length || 0} vehicles linked to active dealership`);
        if ((linkedInventory?.length || 0) === 0) {
          console.log('   ⚠️  No inventory linked to active dealership!');
          console.log('   💡 Solution: Run backfill migration to link inventory\n');
        }
      }
    }
  }

  console.log('\n📋 Summary:');
  console.log('   If dealership_id column is missing: Run migrations');
  console.log('   If inventory has no dealership_id: Run backfill migration');
  console.log('   If no active dealership: Run backfill migration or set manually');
  console.log('   If inventory not linked: Run backfill migration\n');
}

diagnose().catch(console.error);


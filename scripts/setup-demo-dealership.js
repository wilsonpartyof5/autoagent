#!/usr/bin/env node

/**
 * Setup Demo Account with Rock Hill GMC Dealership
 * 
 * This script sets up the demo account to use Rock Hill GMC dealership
 * so that the "Sync inventory" button works and existing vehicles show up.
 * 
 * Usage:
 *   node scripts/setup-demo-dealership.js
 * 
 * Requires:
 *   - SUPABASE_SERVICE_ROLE_KEY in apps/dealer-dashboard/.env.local
 *   - NEXT_PUBLIC_SUPABASE_URL in apps/dealer-dashboard/.env.local
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found');
  console.error('   Add it to apps/dealer-dashboard/.env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.error('   Add it to apps/dealer-dashboard/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEMO_EMAIL = 'demo@autoagent.com';
const ROCK_HILL_DEALER_ID = '11042155';
const ROCK_HILL_ZIP = '29730';
const ROCK_HILL_NAME = 'Rock Hill GMC';

async function setupDemoDealership() {
  console.log('🚀 Setting up Demo Account with Rock Hill GMC Dealership\n');

  try {
    // Step 1: Find demo user
    console.log('📝 Step 1: Finding demo user...');
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      throw listError;
    }

    const demoUser = users.users.find(u => u.email === DEMO_EMAIL);
    if (!demoUser) {
      console.error(`❌ Demo user not found: ${DEMO_EMAIL}`);
      console.error('   Please create the user first or use a different email');
      process.exit(1);
    }

    const demoUserId = demoUser.id;
    console.log(`✅ Found demo user: ${DEMO_EMAIL} (${demoUserId})\n`);

    // Step 2: Find or create Rock Hill GMC dealership
    console.log('📝 Step 2: Finding/creating Rock Hill GMC dealership...');
    let { data: dealerships, error: dealershipError } = await supabase
      .from('dealerships')
      .select('*')
      .or(`name.ilike.%Rock Hill%,marketcheck_dealer_id.eq.${ROCK_HILL_DEALER_ID}`)
      .limit(1);

    if (dealershipError) {
      console.error('❌ Error finding dealership:', dealershipError.message);
      throw dealershipError;
    }

    let rockHillDealershipId = null;

    if (dealerships && dealerships.length > 0) {
      rockHillDealershipId = dealerships[0].id;
      console.log(`✅ Found existing dealership: ${dealerships[0].name} (${rockHillDealershipId})`);
      
      // Update to ensure correct MarketCheck ID
      const { error: updateError } = await supabase
        .from('dealerships')
        .update({
          name: ROCK_HILL_NAME,
          marketcheck_dealer_id: ROCK_HILL_DEALER_ID,
          marketcheck_zip: ROCK_HILL_ZIP,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rockHillDealershipId);

      if (updateError) {
        console.warn('⚠️  Warning: Could not update dealership:', updateError.message);
      } else {
        console.log('   Updated dealership with Rock Hill GMC details');
      }
    } else {
      // Create new dealership
      const { data: newDealership, error: createError } = await supabase
        .from('dealerships')
        .insert({
          name: ROCK_HILL_NAME,
          marketcheck_dealer_id: ROCK_HILL_DEALER_ID,
          marketcheck_zip: ROCK_HILL_ZIP,
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating dealership:', createError.message);
        throw createError;
      }

      rockHillDealershipId = newDealership.id;
      console.log(`✅ Created dealership: ${ROCK_HILL_NAME} (${rockHillDealershipId})`);
    }
    console.log('');

    // Step 3: Link user to dealership
    console.log('📝 Step 3: Linking user to dealership...');
    const { error: linkError } = await supabase
      .from('user_dealerships')
      .upsert({
        user_id: demoUserId,
        dealership_id: rockHillDealershipId,
        role: 'owner',
      }, {
        onConflict: 'user_id,dealership_id',
      });

    if (linkError) {
      console.error('❌ Error linking user to dealership:', linkError.message);
      throw linkError;
    }
    console.log('✅ User linked to dealership\n');

    // Step 4: Set active dealership preference
    console.log('📝 Step 4: Setting active dealership preference...');
    const { error: prefError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: demoUserId,
        active_dealership_id: rockHillDealershipId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (prefError) {
      console.error('❌ Error setting preference:', prefError.message);
      throw prefError;
    }
    console.log('✅ Active dealership preference set\n');

    // Step 5: Check existing vehicles
    console.log('📝 Step 5: Checking existing vehicles...');
    const { count: vehicleCount, error: countError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('availability_status', 'available');

    if (countError) {
      console.warn('⚠️  Could not check vehicles:', countError.message);
    } else {
      console.log(`✅ Found ${vehicleCount || 0} available vehicles in database`);
      if ((vehicleCount || 0) > 0) {
        console.log('   These should now appear in the inventory page!');
      }
    }
    console.log('');

    // Success summary
    console.log('='.repeat(60));
    console.log('✅ Demo Account Setup Complete!');
    console.log('='.repeat(60));
    console.log(`User: ${DEMO_EMAIL}`);
    console.log(`Dealership: ${ROCK_HILL_NAME}`);
    console.log(`MarketCheck Dealer ID: ${ROCK_HILL_DEALER_ID}`);
    console.log(`Available Vehicles: ${vehicleCount || 0}`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Refresh the inventory page in your browser');
    console.log('   2. You should now see the vehicles');
    console.log('   3. Click "Sync inventory" to test re-syncing from MarketCheck');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run setup
setupDemoDealership();


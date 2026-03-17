#!/usr/bin/env node

/**
 * AutoAgent Vercel Demo Account Setup Script
 * 
 * This script sets up a complete demo account for the Vercel deployment:
 * - Creates demo user in Supabase Auth
 * - Creates/updates profile
 * - Creates or finds Rock Hill GMC dealership
 * - Links user to dealership
 * - Sets active dealership preference
 * - Attaches Rock Hill vehicles to dealership
 * - Marks vehicles as live/published
 * 
 * Usage:
 *   node scripts/setup-vercel-demo.js
 * 
 * Requires:
 *   - SUPABASE_SERVICE_ROLE_KEY in apps/dealer-dashboard/.env.local
 *   - NEXT_PUBLIC_SUPABASE_URL in apps/dealer-dashboard/.env.local
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOW_PROD_WRITE = process.env.ALLOW_PROD_WRITE === 'true';

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found');
  console.error('   Add it to apps/dealer-dashboard/.env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.error('   Add it to apps/dealer-dashboard/.env.local');
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

// Production write guard: prevent accidental writes to production database
const PROD_INDICATORS = ['prod', 'production', 'vercel', 'live'];
function isProdUrl(url) {
  const lowerUrl = url.toLowerCase();
  return PROD_INDICATORS.some(indicator => lowerUrl.includes(indicator));
}

if (isProdUrl(SUPABASE_URL) && !ALLOW_PROD_WRITE) {
  console.error('');
  console.error('⛔ PRODUCTION WRITE GUARD');
  console.error('='.repeat(50));
  console.error('This script is attempting to write to a production-like database:');
  console.error(`  ${SUPABASE_URL}`);
  console.error('');
  console.error('This is a DEMO/SEED script and should NOT run against production.');
  console.error('');
  console.error('To proceed anyway (not recommended):');
  console.error('  ALLOW_PROD_WRITE=true node scripts/setup-vercel-demo.js');
  console.error('');
  console.error('For safe demo setup, use a separate Supabase project or local instance.');
  console.error('='.repeat(50));
  console.error('');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEMO_EMAIL = 'demo@autoagent.com';
const DEMO_PASSWORD = 'Demo123!@#';
const ROCK_HILL_DEALER_ID = '11042155';
const ROCK_HILL_ZIP = '29730';

async function setupDemoAccount() {
  console.log('🚀 Setting up Vercel Demo Account\n');
  console.log('Dashboard URL: https://autoagent-dealer-dashboard.vercel.app\n');

  try {
    // Step 1: Create or find demo user
    console.log('📝 Step 1: Creating demo user...');
    let demoUserId = null;

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      throw listError;
    }

    const existingUser = existingUsers.users.find(u => u.email === DEMO_EMAIL);
    
    if (existingUser) {
      demoUserId = existingUser.id;
      console.log(`✅ Demo user already exists: ${DEMO_EMAIL} (${demoUserId})`);
      console.log('   Password: Demo123!@#');
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true, // Auto-confirm email
      });

      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        throw createError;
      }

      demoUserId = newUser.user.id;
      console.log(`✅ Created demo user: ${DEMO_EMAIL} (${demoUserId})`);
      console.log(`   Password: ${DEMO_PASSWORD}`);
    }

    // Step 2: Create/update profile
    console.log('\n📝 Step 2: Creating/updating profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: demoUserId,
        email: DEMO_EMAIL,
        onboarding_completed: true,
        inventory_connected: true,
        billing_active: true, // For polished demo
        dms_provider: 'marketcheck',
        marketcheck_dealer_id: ROCK_HILL_DEALER_ID,
        marketcheck_zip: ROCK_HILL_ZIP,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (profileError) {
      console.error('❌ Error updating profile:', profileError.message);
      throw profileError;
    }
    console.log('✅ Profile created/updated');

    // Step 3: Find or create Rock Hill GMC dealership
    console.log('\n📝 Step 3: Finding/creating Rock Hill GMC dealership...');
    let { data: dealerships, error: dealershipError } = await supabase
      .from('dealerships')
      .select('*')
      .or(`name.ilike.%Rock Hill%GMC%,and(marketcheck_dealer_id.eq.${ROCK_HILL_DEALER_ID},marketcheck_zip.eq.${ROCK_HILL_ZIP})`)
      .limit(1);

    if (dealershipError) {
      console.error('❌ Error finding dealership:', dealershipError.message);
      throw dealershipError;
    }

    let rockHillDealershipId = null;

    if (dealerships && dealerships.length > 0) {
      rockHillDealershipId = dealerships[0].id;
      console.log(`✅ Found existing dealership: ${dealerships[0].name} (${rockHillDealershipId})`);
    } else {
      // Create new dealership
      const { data: newDealership, error: createDealershipError } = await supabase
        .from('dealerships')
        .insert({
          name: 'Rock Hill GMC',
          marketcheck_dealer_id: ROCK_HILL_DEALER_ID,
          marketcheck_zip: ROCK_HILL_ZIP,
        })
        .select()
        .single();

      if (createDealershipError) {
        console.error('❌ Error creating dealership:', createDealershipError.message);
        throw createDealershipError;
      }

      rockHillDealershipId = newDealership.id;
      console.log(`✅ Created dealership: Rock Hill GMC (${rockHillDealershipId})`);
    }

    // Step 4: Link user to dealership
    console.log('\n📝 Step 4: Linking user to dealership...');
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
    console.log('✅ User linked to dealership');

    // Step 5: Set active dealership preference
    console.log('\n📝 Step 5: Setting active dealership preference...');
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
    console.log('✅ Active dealership preference set');

    // Step 6: Find and attach Rock Hill vehicles
    console.log('\n📝 Step 6: Finding and attaching Rock Hill vehicles...');
    
    // First, find vehicles without dealership_id or with Rock Hill dealer info
    let { data: vehicles, error: vehiclesError } = await supabase
      .from('inventory_vehicles')
      .select('id, dealership_id, dealer_name, dealer_id, is_live')
      .or(`dealer_name.ilike.%Rock Hill%,dealer_id.eq.${ROCK_HILL_DEALER_ID}`)
      .limit(20);

    if (vehiclesError) {
      console.error('❌ Error finding vehicles:', vehiclesError.message);
      throw vehiclesError;
    }

    if (!vehicles || vehicles.length === 0) {
      console.log('⚠️  No Rock Hill vehicles found. Checking all vehicles...');
      // Check all vehicles
      const { data: allVehicles } = await supabase
        .from('inventory_vehicles')
        .select('id, dealership_id, dealer_name, dealer_id, is_live')
        .limit(20);

      if (allVehicles && allVehicles.length > 0) {
        console.log(`   Found ${allVehicles.length} vehicles total`);
        console.log('   You may need to run MarketCheck sync or seed demo inventory');
      } else {
        console.log('   No vehicles found in database');
        console.log('   Run scripts/seed-demo-inventory.sql or sync from MarketCheck');
      }
    } else {
      // Update vehicles to link to dealership and mark as live
      const vehicleIds = vehicles.map(v => v.id);
      const { error: updateError } = await supabase
        .from('inventory_vehicles')
        .update({
          dealership_id: rockHillDealershipId,
          is_live: true,
          published_at: new Date().toISOString(),
          published_by: demoUserId,
          updated_at: new Date().toISOString(),
        })
        .in('id', vehicleIds);

      if (updateError) {
        console.error('❌ Error updating vehicles:', updateError.message);
        throw updateError;
      }

      console.log(`✅ Updated ${vehicleIds.length} vehicles to Rock Hill dealership`);
    }

    // Step 7: Verify final count
    const { data: finalVehicles, error: countError } = await supabase
      .from('inventory_vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('dealership_id', rockHillDealershipId)
      .eq('is_live', true);

    if (countError) {
      console.warn('⚠️  Could not verify vehicle count:', countError.message);
    } else {
      const liveCount = finalVehicles?.length || 0;
      console.log(`✅ Live vehicles: ${liveCount}`);
    }

    // Success summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Demo Account Setup Complete!');
    console.log('='.repeat(50));
    console.log(`Email: ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log(`Dealership: Rock Hill GMC (${rockHillDealershipId})`);
    console.log(`Live Vehicles: ${finalVehicles?.length || 0}`);
    console.log('');
    console.log('🔗 Login at: https://autoagent-dealer-dashboard.vercel.app/auth');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run setup
setupDemoAccount();


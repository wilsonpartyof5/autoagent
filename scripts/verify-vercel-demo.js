#!/usr/bin/env node

/**
 * Verify Vercel Demo Account Setup
 * 
 * This script verifies that the demo account is properly configured:
 * - User exists and can log in
 * - Profile is set up correctly
 * - Dealership is linked
 * - Vehicles are attached and live
 * 
 * Usage:
 *   node scripts/verify-vercel-demo.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('   Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DEMO_EMAIL = 'demo@autoagent.com';

async function verifyDemoAccount() {
  console.log('🔍 Verifying Vercel Demo Account Setup\n');

  let allChecksPassed = true;

  try {
    // Check 1: User exists
    console.log('📝 Check 1: Demo user exists...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;

    const demoUser = users.users.find(u => u.email === DEMO_EMAIL);
    if (!demoUser) {
      console.log('❌ Demo user not found');
      allChecksPassed = false;
    } else {
      console.log(`✅ Demo user found: ${demoUser.email} (${demoUser.id})`);
      console.log(`   Email confirmed: ${demoUser.email_confirmed_at ? 'Yes' : 'No'}`);
    }

    // Check 2: Profile exists and is configured
    console.log('\n📝 Check 2: Profile configuration...');
    if (demoUser) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', demoUser.id)
        .single();

      if (profileError || !profile) {
        console.log('❌ Profile not found');
        allChecksPassed = false;
      } else {
        console.log('✅ Profile found');
        console.log(`   Onboarding completed: ${profile.onboarding_completed ? 'Yes' : 'No'}`);
        console.log(`   Inventory connected: ${profile.inventory_connected ? 'Yes' : 'No'}`);
        console.log(`   Billing active: ${profile.billing_active ? 'Yes' : 'No'}`);
        console.log(`   MarketCheck Dealer ID: ${profile.marketcheck_dealer_id || 'Not set'}`);

        if (!profile.onboarding_completed || !profile.inventory_connected) {
          allChecksPassed = false;
        }
      }
    }

    // Check 3: Dealership exists
    console.log('\n📝 Check 3: Dealership setup...');
    const { data: dealerships, error: dealershipError } = await supabase
      .from('dealerships')
      .select('*')
      .or('name.ilike.%Rock Hill%GMC%,and(marketcheck_dealer_id.eq.11042155,marketcheck_zip.eq.29730)')
      .limit(1);

    if (dealershipError || !dealerships || dealerships.length === 0) {
      console.log('❌ Rock Hill GMC dealership not found');
      allChecksPassed = false;
    } else {
      const dealership = dealerships[0];
      console.log(`✅ Dealership found: ${dealership.name} (${dealership.id})`);
      console.log(`   MarketCheck Dealer ID: ${dealership.marketcheck_dealer_id}`);
      console.log(`   ZIP: ${dealership.marketcheck_zip}`);

      // Check 4: User-dealership link
      console.log('\n📝 Check 4: User-dealership link...');
      if (demoUser) {
        const { data: userDealerships, error: linkError } = await supabase
          .from('user_dealerships')
          .select('*, dealerships(name)')
          .eq('user_id', demoUser.id)
          .eq('dealership_id', dealership.id);

        if (linkError || !userDealerships || userDealerships.length === 0) {
          console.log('❌ User not linked to dealership');
          allChecksPassed = false;
        } else {
          console.log(`✅ User linked to dealership (role: ${userDealerships[0].role})`);
        }

        // Check 5: Active dealership preference
        console.log('\n📝 Check 5: Active dealership preference...');
        const { data: preferences, error: prefError } = await supabase
          .from('user_preferences')
          .select('*, dealerships(name)')
          .eq('user_id', demoUser.id)
          .single();

        if (prefError || !preferences) {
          console.log('❌ Active dealership preference not set');
          allChecksPassed = false;
        } else {
          console.log(`✅ Active dealership: ${preferences.dealerships?.name || 'Unknown'}`);
          if (preferences.active_dealership_id !== dealership.id) {
            console.log('⚠️  Active dealership does not match Rock Hill GMC');
            allChecksPassed = false;
          }
        }
      }

      // Check 6: Vehicles attached and live
      console.log('\n📝 Check 6: Vehicle inventory...');
      const { data: vehicles, error: vehiclesError, count } = await supabase
        .from('inventory_vehicles')
        .select('id, year, make, model, condition, price, is_live, published_at', { count: 'exact' })
        .eq('dealership_id', dealership.id);

      if (vehiclesError) {
        console.log('❌ Error fetching vehicles:', vehiclesError.message);
        allChecksPassed = false;
      } else {
        const totalVehicles = count || vehicles?.length || 0;
        const liveVehicles = vehicles?.filter(v => v.is_live === true).length || 0;
        const publishedVehicles = vehicles?.filter(v => v.published_at).length || 0;

        console.log(`✅ Vehicles found: ${totalVehicles} total`);
        console.log(`   Live vehicles: ${liveVehicles}`);
        console.log(`   Published vehicles: ${publishedVehicles}`);

        if (totalVehicles === 0) {
          console.log('⚠️  No vehicles found. You may need to:');
          console.log('   1. Run MarketCheck sync for dealer 11042155');
          console.log('   2. Or seed demo inventory (scripts/seed-demo-inventory.sql)');
          allChecksPassed = false;
        } else if (liveVehicles === 0) {
          console.log('⚠️  No live vehicles. Vehicles need to be marked as live.');
          allChecksPassed = false;
        } else {
          console.log('\n   Sample vehicles:');
          vehicles?.slice(0, 5).forEach(v => {
            console.log(`   - ${v.year} ${v.make} ${v.model} (${v.condition}) - $${v.price?.toLocaleString() || 'N/A'} - Live: ${v.is_live ? 'Yes' : 'No'}`);
          });
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allChecksPassed) {
      console.log('✅ All checks passed! Demo account is ready.');
      console.log('\n🔗 Login at: https://autoagent-dealer-dashboard.vercel.app/auth');
      console.log('   Email: demo@autoagent.com');
      console.log('   Password: Demo123!@#');
    } else {
      console.log('⚠️  Some checks failed. Review the output above.');
      console.log('\n💡 Run setup script: node scripts/setup-vercel-demo.js');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

verifyDemoAccount();


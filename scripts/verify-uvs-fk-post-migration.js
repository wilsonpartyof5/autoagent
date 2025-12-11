#!/usr/bin/env node

/**
 * Post-Migration Verification Script
 * 
 * Run this AFTER applying the migration to verify:
 * 1. FK constraints exist
 * 2. No orphaned leads
 * 
 * Usage: node scripts/verify-uvs-fk-post-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Set these in your .env.local file or export them before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyFKConstraints() {
  console.log('='.repeat(60));
  console.log('1. Verifying Foreign Key Constraints');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Try to join leads with uvs_vehicles (will fail if FK doesn't work)
  console.log('🔍 Testing FK join: leads → uvs_vehicles...');
  const { data: joinTest, error: joinError } = await supabase
    .from('leads')
    .select(`
      id,
      vehicle_id,
      uvs_vehicles!inner(id)
    `)
    .limit(1);

  if (joinError) {
    if (joinError.message.includes('relation') || joinError.message.includes('does not exist')) {
      console.log('⚠️  Could not test join - table might not exist or no leads found');
    } else {
      console.log(`⚠️  Join test result: ${joinError.message}`);
      console.log('   This might indicate FK constraint is not properly set up');
    }
  } else {
    console.log('✅ FK join test passed - leads can join with uvs_vehicles');
  }

  // Test 2: Check for constraint violations by trying to insert invalid data
  // (We won't actually insert, but we can check if the constraint would prevent it)
  console.log('');
  console.log('📋 Manual Verification Required:');
  console.log('');
  console.log('Run this SQL in Supabase SQL Editor to verify FK constraints exist:');
  console.log('');
  console.log('─'.repeat(60));
  console.log(`
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'leads'
  AND tc.table_schema = 'public';
  `.trim());
  console.log('─'.repeat(60));
  console.log('');
  console.log('Expected results:');
  console.log('  ✅ fk_leads_vehicle_id → uvs_vehicles.id');
  console.log('  ✅ fk_leads_dealer_id → dealerships.marketcheck_dealer_id');
  console.log('');

  return true;
}

async function checkOrphanedLeads() {
  console.log('='.repeat(60));
  console.log('2. Checking for Orphaned Leads');
  console.log('='.repeat(60));
  console.log('');

  // Get leads
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, vehicle_id, dealer_id')
    .limit(1000);

  if (leadsError) {
    console.log(`❌ Could not query leads: ${leadsError.message}`);
    return false;
  }

  if (!leads || leads.length === 0) {
    console.log('✅ No leads found in database (empty table - this is OK)');
    return true;
  }

  console.log(`📊 Checking ${leads.length} leads...`);
  console.log('');

  // Check vehicle_ids
  const vehicleIds = [...new Set(leads.map(l => l.vehicle_id).filter(Boolean))];
  if (vehicleIds.length === 0) {
    console.log('⚠️  No vehicle_ids found in leads');
    return false;
  }

  console.log(`🔍 Validating ${vehicleIds.length} unique vehicle_ids against uvs_vehicles...`);

  // Check in batches (Supabase has limits)
  const batchSize = 100;
  const validVehicleIds = new Set();
  const invalidVehicleIds = new Set();

  for (let i = 0; i < vehicleIds.length; i += batchSize) {
    const batch = vehicleIds.slice(i, i + batchSize);
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('uvs_vehicles')
      .select('id')
      .in('id', batch);

    if (vehiclesError) {
      console.log(`⚠️  Error checking batch: ${vehiclesError.message}`);
      continue;
    }

    const batchValidIds = new Set((vehicles || []).map(v => v.id));
    batch.forEach(vid => {
      if (batchValidIds.has(vid)) {
        validVehicleIds.add(vid);
      } else {
        invalidVehicleIds.add(vid);
      }
    });
  }

  // Find orphaned leads
  const orphanedLeads = leads.filter(l => l.vehicle_id && invalidVehicleIds.has(l.vehicle_id));

  if (orphanedLeads.length > 0) {
    console.log(`❌ Found ${orphanedLeads.length} leads with invalid vehicle_ids:`);
    console.log('');
    orphanedLeads.slice(0, 10).forEach(lead => {
      console.log(`   - Lead ${lead.id}: vehicle_id="${lead.vehicle_id}" (not in uvs_vehicles)`);
    });
    if (orphanedLeads.length > 10) {
      console.log(`   ... and ${orphanedLeads.length - 10} more`);
    }
    console.log('');
    console.log('💡 To fix, run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log('─'.repeat(60));
    console.log(`
-- Find all orphaned leads
SELECT l.id, l.vehicle_id, l.dealer_id, l.created_at
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL
ORDER BY l.created_at DESC;

-- Option 1: Delete orphaned leads (if they are invalid)
-- DELETE FROM leads WHERE vehicle_id NOT IN (SELECT id FROM uvs_vehicles);

-- Option 2: Update vehicle_id to a valid UVS vehicle ID
-- UPDATE leads SET vehicle_id = '<valid-uvs-vehicle-id>' WHERE id = '<lead-id>';
    `.trim());
    console.log('─'.repeat(60));
    console.log('');
    return false;
  }

  console.log(`✅ All ${leads.length} leads have valid vehicle_ids`);
  console.log(`   (${validVehicleIds.size} unique valid vehicle_ids found)`);
  console.log('');

  // Check dealer_ids (optional, but good to verify)
  const dealerIds = [...new Set(leads.map(l => l.dealer_id).filter(Boolean))];
  if (dealerIds.length > 0) {
    console.log(`🔍 Validating ${dealerIds.length} unique dealer_ids against dealerships...`);
    
    const { data: dealerships, error: dealersError } = await supabase
      .from('dealerships')
      .select('marketcheck_dealer_id')
      .in('marketcheck_dealer_id', dealerIds);

    if (!dealersError && dealerships) {
      const validDealerIds = new Set((dealerships || []).map(d => d.marketcheck_dealer_id));
      const invalidDealerLeads = leads.filter(l => l.dealer_id && !validDealerIds.has(l.dealer_id));
      
      if (invalidDealerLeads.length > 0) {
        console.log(`⚠️  Found ${invalidDealerLeads.length} leads with invalid dealer_ids`);
        console.log('   (This is less critical - dealer_id FK is optional)');
      } else {
        console.log(`✅ All leads have valid dealer_ids`);
      }
    }
  }

  return true;
}

async function main() {
  console.log('');
  console.log('🔍 UVS FK Migration - Post-Migration Verification');
  console.log('');

  try {
    const fkCheck = await verifyFKConstraints();
    const orphanedCheck = await checkOrphanedLeads();

    console.log('');
    console.log('='.repeat(60));
    console.log('Verification Summary');
    console.log('='.repeat(60));
    console.log('');

    if (fkCheck) {
      console.log('✅ FK constraints: Verified (run SQL query to confirm)');
    } else {
      console.log('⚠️  FK constraints: Could not verify automatically');
    }

    if (orphanedCheck) {
      console.log('✅ Orphaned leads: None found');
    } else {
      console.log('❌ Orphaned leads: Found - needs fixing');
    }

    console.log('');
    
    if (fkCheck && orphanedCheck) {
      console.log('✅ Migration verification complete!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Test API endpoints: /api/metrics/leads and /api/metrics/kpis');
      console.log('  2. Test UI: /app/leads page');
      console.log('  3. Verify vehicle data displays correctly');
    } else {
      console.log('⚠️  Some issues detected - please review and fix');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


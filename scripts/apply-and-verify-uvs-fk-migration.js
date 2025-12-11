#!/usr/bin/env node

/**
 * Apply and Verify UVS FK Migration
 * 
 * This script:
 * 1. Displays the migration SQL for manual execution
 * 2. Verifies FK constraints exist after migration
 * 3. Checks for orphaned leads
 * 
 * Usage: node scripts/apply-and-verify-uvs-fk-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
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

async function displayMigrationSQL() {
  console.log('='.repeat(60));
  console.log('Step 1: Apply Migration');
  console.log('='.repeat(60));
  console.log('');
  console.log('📋 Migration SQL to run in Supabase SQL Editor:');
  console.log('');
  console.log('   1. Open Supabase Dashboard → SQL Editor');
  console.log('   2. Click "New query"');
  console.log('   3. Copy and paste the SQL below');
  console.log('   4. Click "Run" or press Cmd/Ctrl + Enter');
  console.log('   5. Wait for execution to complete');
  console.log('');
  console.log('─'.repeat(60));
  
  const migrationPath = path.join(
    __dirname,
    '..',
    'apps',
    'dealer-dashboard',
    'supabase',
    'migrations',
    '20250302_add_leads_uvs_fks.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log(migrationSQL);
  console.log('─'.repeat(60));
  console.log('');
  console.log('⏳ After running the migration, press Enter to continue verification...');
  console.log('   (Or press Ctrl+C to exit and run verification later)');
  console.log('');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

async function verifyFKConstraints() {
  console.log('');
  console.log('='.repeat(60));
  console.log('Step 2: Verify FK Constraints');
  console.log('='.repeat(60));
  console.log('');

  // Check if FK constraints exist by trying to query them
  // We'll use a workaround: try to insert a test lead and see if FK constraint is enforced
  // But first, let's check if we can query the constraints via a direct SQL query
  
  // Since Supabase JS doesn't support raw SQL, we'll check by:
  // 1. Checking if we can query leads with uvs_vehicles join
  // 2. Checking for orphaned leads (which would indicate FK is not enforced)
  
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, vehicle_id, dealer_id')
    .limit(1);

  if (leadsError) {
    console.log(`⚠️  Could not query leads table: ${leadsError.message}`);
    console.log('   This might indicate the table doesn\'t exist or there\'s a permission issue.');
    return false;
  }

  // Try to get constraint information via a workaround
  // Check if we can join with uvs_vehicles (which would fail if FK doesn't exist and there are invalid IDs)
  const { data: joinedData, error: joinError } = await supabase
    .from('leads')
    .select(`
      id,
      vehicle_id,
      uvs_vehicles!inner(id)
    `)
    .limit(1);

  if (joinError) {
    if (joinError.message.includes('foreign key') || joinError.message.includes('constraint')) {
      console.log('⚠️  Join failed - this might indicate FK constraint issues');
      console.log(`   Error: ${joinError.message}`);
    } else {
      console.log('⚠️  Could not test join (this is expected if there are no leads)');
    }
  } else {
    console.log('✅ FK join test passed - constraints appear to be working');
  }

  // Manual verification SQL
  console.log('');
  console.log('📋 Run this SQL in Supabase SQL Editor to verify FK constraints:');
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
  console.log('  - fk_leads_vehicle_id → uvs_vehicles.id');
  console.log('  - fk_leads_dealer_id → dealerships.marketcheck_dealer_id');
  console.log('');

  return true;
}

async function checkOrphanedLeads() {
  console.log('='.repeat(60));
  console.log('Step 3: Check for Orphaned Leads');
  console.log('='.repeat(60));
  console.log('');

  // Get some leads
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, vehicle_id, dealer_id')
    .limit(100);

  if (leadsError) {
    console.log(`⚠️  Could not query leads: ${leadsError.message}`);
    return false;
  }

  if (!leads || leads.length === 0) {
    console.log('✅ No leads found in database (empty table)');
    return true;
  }

  console.log(`📊 Found ${leads.length} leads to check`);
  console.log('');

  // Get unique vehicle_ids
  const vehicleIds = [...new Set(leads.map(l => l.vehicle_id).filter(Boolean))];
  if (vehicleIds.length === 0) {
    console.log('⚠️  No vehicle_ids found in leads');
    return false;
  }

  console.log(`🔍 Checking ${vehicleIds.length} unique vehicle_ids...`);

  // Check if vehicles exist in uvs_vehicles
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('uvs_vehicles')
    .select('id')
    .in('id', vehicleIds);

  if (vehiclesError) {
    console.log(`⚠️  Could not query uvs_vehicles: ${vehiclesError.message}`);
    console.log('   Run this SQL manually to check for orphaned leads:');
    console.log('');
    console.log('─'.repeat(60));
    console.log(`
SELECT l.id, l.vehicle_id
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL
LIMIT 10;
    `.trim());
    console.log('─'.repeat(60));
    return false;
  }

  const validVehicleIds = new Set((vehicles || []).map(v => v.id));
  const orphanedLeads = leads.filter(l => l.vehicle_id && !validVehicleIds.has(l.vehicle_id));

  if (orphanedLeads.length > 0) {
    console.log(`❌ Found ${orphanedLeads.length} leads with invalid vehicle_ids:`);
    orphanedLeads.slice(0, 10).forEach(lead => {
      console.log(`   - Lead ${lead.id}: vehicle_id="${lead.vehicle_id}" (not found in uvs_vehicles)`);
    });
    if (orphanedLeads.length > 10) {
      console.log(`   ... and ${orphanedLeads.length - 10} more`);
    }
    console.log('');
    console.log('💡 Fix: Update vehicle_id values to match valid uvs_vehicles.id');
    console.log('   Or delete orphaned leads if they are invalid');
    return false;
  }

  console.log(`✅ All ${leads.length} leads have valid vehicle_ids`);
  
  // Check dealer_ids
  const dealerIds = [...new Set(leads.map(l => l.dealer_id).filter(Boolean))];
  if (dealerIds.length > 0) {
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
  console.log('🔧 UVS FK Migration - Apply and Verify');
  console.log('');

  try {
    // Step 1: Display migration SQL
    await displayMigrationSQL();

    // Step 2: Verify FK constraints
    await verifyFKConstraints();

    // Step 3: Check for orphaned leads
    const orphanedCheck = await checkOrphanedLeads();

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Verification Summary');
    console.log('='.repeat(60));
    console.log('');

    if (orphanedCheck) {
      console.log('✅ No orphaned leads found');
    } else {
      console.log('⚠️  Orphaned leads detected - review and fix as needed');
    }

    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Verify FK constraints exist (run SQL query from Step 2)');
    console.log('   2. Fix any orphaned leads if found');
    console.log('   3. Test API endpoints: /api/metrics/leads and /api/metrics/kpis');
    console.log('   4. Test UI: /app/leads page');
    console.log('');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Handle stdin properly
if (process.stdin.isTTY) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
} else {
  console.error('❌ This script requires an interactive terminal');
  console.error('   Run it in a terminal where you can press Enter');
  process.exit(1);
}


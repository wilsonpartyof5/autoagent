#!/usr/bin/env node

/**
 * Verification script for UVS FK alignment
 * 
 * Verifies that:
 * 1. FK constraints exist on leads table
 * 2. Metrics endpoints use UVS joins
 * 3. Leads page uses UVS joins
 * 
 * Usage: node scripts/verify-uvs-fk-alignment.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Set these in your .env.local file or export them before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkFKConstraints() {
  console.log('='.repeat(60));
  console.log('1. Checking Foreign Key Constraints');
  console.log('='.repeat(60));
  console.log('');

  // Check leads table FKs
  const { data: leadsFKs, error: leadsFKError } = await supabase.rpc('exec_sql', {
    query: `
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
    `
  });

  if (leadsFKError) {
    // Try direct query instead
    console.log('⚠️  Could not use RPC, checking via direct query...');
    console.log('   Please run this SQL manually in Supabase SQL Editor:');
    console.log('');
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
        AND tc.table_name = 'leads';
    `);
    console.log('');
    console.log('Expected constraints:');
    console.log('  - fk_leads_vehicle_id → uvs_vehicles.id');
    console.log('  - fk_leads_dealer_id → dealerships.marketcheck_dealer_id');
    return false;
  }

  const expectedFKs = {
    'fk_leads_vehicle_id': { foreign_table: 'uvs_vehicles', foreign_column: 'id' },
    'fk_leads_dealer_id': { foreign_table: 'dealerships', foreign_column: 'marketcheck_dealer_id' },
  };

  const foundFKs = {};
  if (leadsFKs && leadsFKs.length > 0) {
    leadsFKs.forEach(fk => {
      foundFKs[fk.constraint_name] = {
        foreign_table: fk.foreign_table_name,
        foreign_column: fk.foreign_column_name,
      };
    });
  }

  let allFound = true;
  for (const [constraintName, expected] of Object.entries(expectedFKs)) {
    if (foundFKs[constraintName]) {
      const found = foundFKs[constraintName];
      if (found.foreign_table === expected.foreign_table && 
          found.foreign_column === expected.foreign_column) {
        console.log(`✅ ${constraintName}: leads → ${found.foreign_table}.${found.foreign_column}`);
      } else {
        console.log(`❌ ${constraintName}: Expected ${expected.foreign_table}.${expected.foreign_column}, found ${found.foreign_table}.${found.foreign_column}`);
        allFound = false;
      }
    } else {
      console.log(`❌ ${constraintName}: Not found`);
      console.log(`   Run migration: apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`);
      allFound = false;
    }
  }

  console.log('');
  return allFound;
}

function checkCodeFiles() {
  console.log('='.repeat(60));
  console.log('2. Checking Code Files for UVS Joins');
  console.log('='.repeat(60));
  console.log('');

  const filesToCheck = [
    {
      path: 'apps/dealer-dashboard/src/app/api/metrics/leads/route.ts',
      pattern: /uvs_vehicles!inner/,
      description: 'Metrics leads endpoint uses UVS join',
    },
    {
      path: 'apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts',
      pattern: /uvs_vehicles!inner/,
      description: 'Metrics KPIs endpoint uses UVS join',
    },
    {
      path: 'apps/dealer-dashboard/src/app/app/leads/page.tsx',
      pattern: /uvs_vehicles!inner/,
      description: 'Leads page uses UVS join',
    },
  ];

  let allFound = true;
  for (const file of filesToCheck) {
    const fullPath = path.join(process.cwd(), file.path);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ ${file.path}: File not found`);
      allFound = false;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    if (file.pattern.test(content)) {
      console.log(`✅ ${file.path}: ${file.description}`);
    } else {
      console.log(`❌ ${file.path}: Missing UVS join`);
      console.log(`   Expected pattern: ${file.pattern}`);
      allFound = false;
    }
  }

  console.log('');
  return allFound;
}

async function checkOrphanedLeads() {
  console.log('='.repeat(60));
  console.log('3. Checking for Orphaned Leads');
  console.log('='.repeat(60));
  console.log('');

  // Check for leads without matching UVS vehicles
  const { data: orphanedLeads, error } = await supabase
    .from('leads')
    .select('id, vehicle_id')
    .limit(100);

  if (error) {
    console.log(`⚠️  Could not check orphaned leads: ${error.message}`);
    console.log('   Run this SQL manually:');
    console.log(`
      SELECT l.id, l.vehicle_id
      FROM leads l
      LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
      WHERE v.id IS NULL
      LIMIT 10;
    `);
    return false;
  }

  if (!orphanedLeads || orphanedLeads.length === 0) {
    console.log('✅ No leads found (empty table or all leads have valid vehicle_ids)');
    return true;
  }

  // Check first few leads for valid vehicle_ids
  const vehicleIds = [...new Set(orphanedLeads.map(l => l.vehicle_id).filter(Boolean))];
  if (vehicleIds.length === 0) {
    console.log('⚠️  No vehicle_ids found in leads');
    return false;
  }

  const { data: vehicles, error: vehiclesError } = await supabase
    .from('uvs_vehicles')
    .select('id')
    .in('id', vehicleIds.slice(0, 10));

  if (vehiclesError) {
    console.log(`⚠️  Could not check vehicles: ${vehiclesError.message}`);
    return false;
  }

  const validVehicleIds = new Set((vehicles || []).map(v => v.id));
  const invalidLeads = orphanedLeads.filter(l => l.vehicle_id && !validVehicleIds.has(l.vehicle_id));

  if (invalidLeads.length > 0) {
    console.log(`❌ Found ${invalidLeads.length} leads with invalid vehicle_ids:`);
    invalidLeads.slice(0, 5).forEach(lead => {
      console.log(`   - Lead ${lead.id}: vehicle_id=${lead.vehicle_id} (not found in uvs_vehicles)`);
    });
    if (invalidLeads.length > 5) {
      console.log(`   ... and ${invalidLeads.length - 5} more`);
    }
    console.log('');
    console.log('   Fix: Update vehicle_id values to match valid uvs_vehicles.id');
    return false;
  }

  console.log(`✅ All checked leads have valid vehicle_ids (checked ${orphanedLeads.length} leads)`);
  return true;
}

async function main() {
  console.log('');
  console.log('🔍 UVS FK Alignment Verification');
  console.log('');

  const results = {
    fkConstraints: await checkFKConstraints(),
    codeFiles: checkCodeFiles(),
    orphanedLeads: await checkOrphanedLeads(),
  };

  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log('');

  const allPassed = Object.values(results).every(r => r === true);

  if (results.fkConstraints) {
    console.log('✅ FK Constraints: Present');
  } else {
    console.log('❌ FK Constraints: Missing or incorrect');
    console.log('   Run: apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql');
  }

  if (results.codeFiles) {
    console.log('✅ Code Files: Using UVS joins');
  } else {
    console.log('❌ Code Files: Missing UVS joins');
    console.log('   See verification output above for details');
  }

  if (results.orphanedLeads) {
    console.log('✅ Orphaned Leads: None found');
  } else {
    console.log('⚠️  Orphaned Leads: Check manually');
  }

  console.log('');

  if (allPassed) {
    console.log('✅ All checks passed! UVS FK alignment is correct.');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Please review and fix issues above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});


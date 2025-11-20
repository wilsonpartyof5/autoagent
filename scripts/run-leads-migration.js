#!/usr/bin/env node

/**
 * Run the leads table migration in Supabase
 * 
 * This script executes the migration SQL via Supabase REST API
 * Requires SUPABASE_SERVICE_ROLE_KEY for elevated permissions
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.log('\n💡 To run migrations programmatically, add SUPABASE_SERVICE_ROLE_KEY to .env.local');
  console.log('   Otherwise, run migrations manually in Supabase SQL Editor:\n');
  console.log('   1. Open Supabase Dashboard → SQL Editor');
  console.log('   2. Copy contents of: apps/dealer-dashboard/supabase/migrations/20250127_create_leads_table.sql');
  console.log('   3. Paste and execute in SQL Editor\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('='.repeat(60));
  console.log('Running Leads Table Migration');
  console.log('='.repeat(60));
  console.log('');

  const migrationFile = path.join(__dirname, '..', 'apps', 'dealer-dashboard', 'supabase', 'migrations', '20250127_create_leads_table.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('📄 Reading migration file...');
  console.log(`   File: ${migrationFile}\n`);

  // Supabase JS client doesn't support executing raw SQL directly
  // We need to use the REST API or run in SQL Editor
  console.log('⚠️  Supabase JS client doesn\'t support executing raw SQL directly');
  console.log('   Migrations must be run in Supabase SQL Editor\n');
  console.log('💡 Instructions:');
  console.log('   1. Open Supabase Dashboard → SQL Editor');
  console.log('   2. Copy the SQL below:');
  console.log('   3. Paste into SQL Editor and click \'Run\'');
  console.log('   4. Verify the table exists: node scripts/checkDatabaseSchema.js\n');
  console.log('='.repeat(60));
  console.log('SQL to run:');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
}

runMigration().catch(console.error);


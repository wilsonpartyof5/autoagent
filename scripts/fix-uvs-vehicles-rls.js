#!/usr/bin/env node

/**
 * Fix RLS policies for uvs_vehicles table
 * This allows authenticated users to view vehicles
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for uvs_vehicles table\n');

  const sql = `
-- Enable RLS on uvs_vehicles if not already enabled
alter table uvs_vehicles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view vehicles for their dealership" on uvs_vehicles;
drop policy if exists "Users can view all available vehicles" on uvs_vehicles;
drop policy if exists "Service role can manage vehicles" on uvs_vehicles;

-- Policy: Allow authenticated users to view available vehicles
-- This allows the demo account and other users to see vehicles
create policy "Authenticated users can view available vehicles"
  on uvs_vehicles for select
  using (
    auth.role() = 'authenticated'
    and availability_status = 'available'
  );

-- Policy: Allow service role to manage vehicles (for ingestion/updates)
-- This is needed for the MCP server to insert/update vehicles
create policy "Service role can manage vehicles"
  on uvs_vehicles for all
  using (auth.role() = 'service_role');
`;

  try {
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // RPC might not exist, try direct query (this won't work, but let's show the SQL)
      console.log('⚠️  Direct SQL execution not available via RPC');
      console.log('   Please run this SQL in Supabase SQL Editor:\n');
      console.log(sql);
      console.log('\n📋 Or run this migration file:');
      console.log('   apps/dealer-dashboard/supabase/migrations/20250228_add_uvs_vehicles_rls.sql\n');
      
      // Try an alternative: use the Postgres REST API if available
      // For now, just show the SQL
      return;
    }

    console.log('✅ RLS policies updated successfully!\n');
    console.log('🔄 Please refresh your inventory page to see the vehicles.\n');

  } catch (error) {
    console.error('❌ Error applying RLS policies:', error.message);
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:\n');
    console.log(sql);
    console.log('');
  }
}

fixRLSPolicies();


#!/usr/bin/env node
/**
 * Diagnostic script to check inventory data in Supabase
 * Run: node scripts/check-inventory-data.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dealer-dashboard/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Supabase credentials not found');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEALER_ID = '11042155';
const BOUNDS = {
  north: 34.9855,
  south: 34.9123,
  east: -80.9234,
  west: -81.0123,
};

async function runDiagnostics() {
  console.log('=== INVENTORY SEARCH API DIAGNOSTIC ===\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Dealer ID: ${DEALER_ID}\n`);

  try {
    // Query 1: Total vehicles for dealer
    console.log('1. Total vehicles for dealer_id 11042155:');
    const { count: totalCount, error: countError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', DEALER_ID);
    
    if (countError) {
      console.error(`   ❌ Error: ${countError.message}`);
    } else {
      console.log(`   ✅ Total: ${totalCount} vehicles\n`);
    }

    // Query 2: Vehicles with coordinates
    console.log('2. Vehicles with coordinates:');
    const { count: withCoordsCount, error: coordsError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', DEALER_ID)
      .not('dealer_latitude', 'is', null)
      .not('dealer_longitude', 'is', null);
    
    if (coordsError) {
      console.error(`   ❌ Error: ${coordsError.message}`);
    } else {
      console.log(`   ✅ With coordinates: ${withCoordsCount} vehicles\n`);
    }

    // Query 3: Sample coordinates
    console.log('3. Sample coordinates (first 5):');
    const { data: sampleData, error: sampleError } = await supabase
      .from('uvs_vehicles')
      .select('id, dealer_latitude, dealer_longitude, dealer_name, make, model, availability_status')
      .eq('dealer_id', DEALER_ID)
      .not('dealer_latitude', 'is', null)
      .not('dealer_longitude', 'is', null)
      .limit(5);
    
    if (sampleError) {
      console.error(`   ❌ Error: ${sampleError.message}`);
    } else if (sampleData && sampleData.length > 0) {
      sampleData.forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.make} ${v.model} - Lat: ${v.dealer_latitude}, Lng: ${v.dealer_longitude}, Status: ${v.availability_status}`);
      });
      console.log('');
    } else {
      console.log('   ⚠️  No vehicles with coordinates found\n');
    }

    // Query 4: Availability status distribution
    console.log('4. Availability status distribution:');
    const { data: statusData, error: statusError } = await supabase
      .from('uvs_vehicles')
      .select('availability_status')
      .eq('dealer_id', DEALER_ID);
    
    if (statusError) {
      console.error(`   ❌ Error: ${statusError.message}`);
    } else if (statusData) {
      const statusCounts = {};
      statusData.forEach(v => {
        const status = v.availability_status || 'NULL';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      console.log('');
    }

    // Query 5: Vehicles in bounds
    console.log('5. Vehicles in Rock Hill bounds:');
    const { count: inBoundsCount, error: boundsError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .gte('dealer_latitude', BOUNDS.south)
      .lte('dealer_latitude', BOUNDS.north)
      .gte('dealer_longitude', BOUNDS.west)
      .lte('dealer_longitude', BOUNDS.east)
      .not('dealer_latitude', 'is', null)
      .not('dealer_longitude', 'is', null);
    
    if (boundsError) {
      console.error(`   ❌ Error: ${boundsError.message}`);
    } else {
      console.log(`   ✅ In bounds: ${inBoundsCount} vehicles\n`);
    }

    // Query 6: Vehicles in bounds with availability = 'available'
    console.log('6. Vehicles in bounds with availability_status = "available":');
    const { count: availableInBoundsCount, error: availableError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .gte('dealer_latitude', BOUNDS.south)
      .lte('dealer_latitude', BOUNDS.north)
      .gte('dealer_longitude', BOUNDS.west)
      .lte('dealer_longitude', BOUNDS.east)
      .not('dealer_latitude', 'is', null)
      .not('dealer_longitude', 'is', null)
      .eq('availability_status', 'available');
    
    if (availableError) {
      console.error(`   ❌ Error: ${availableError.message}`);
    } else {
      console.log(`   ✅ Available in bounds: ${availableInBoundsCount} vehicles\n`);
    }

    // Query 7: Check coordinates outside bounds for this dealer
    console.log('7. Vehicles with coordinates OUTSIDE bounds (for dealer):');
    const { data: outsideData, error: outsideError } = await supabase
      .from('uvs_vehicles')
      .select('id, dealer_latitude, dealer_longitude, dealer_name, availability_status, make, model')
      .eq('dealer_id', DEALER_ID)
      .not('dealer_latitude', 'is', null)
      .not('dealer_longitude', 'is', null)
      .or(`dealer_latitude.lt.${BOUNDS.south},dealer_latitude.gt.${BOUNDS.north},dealer_longitude.lt.${BOUNDS.west},dealer_longitude.gt.${BOUNDS.east}`)
      .limit(10);
    
    if (outsideError) {
      console.error(`   ❌ Error: ${outsideError.message}`);
    } else if (outsideData && outsideData.length > 0) {
      console.log(`   ⚠️  Found ${outsideData.length} vehicles outside bounds:`);
      outsideData.forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.make} ${v.model} - Lat: ${v.dealer_latitude}, Lng: ${v.dealer_longitude}, Status: ${v.availability_status}`);
      });
      console.log('');
    } else {
      console.log('   ✅ No vehicles found outside bounds (or all are within bounds)\n');
    }

    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total vehicles for dealer: ${totalCount || 0}`);
    console.log(`Vehicles with coordinates: ${withCoordsCount || 0}`);
    console.log(`Vehicles in bounds: ${inBoundsCount || 0}`);
    console.log(`Available vehicles in bounds: ${availableInBoundsCount || 0}`);
    console.log('');
    
    if (availableInBoundsCount === 0) {
      console.log('🔍 ROOT CAUSE ANALYSIS:');
      if (totalCount === 0) {
        console.log('   ❌ No vehicles exist for this dealer_id');
        console.log('   → Fix: Run inventory sync to import vehicles');
      } else if (withCoordsCount === 0) {
        console.log('   ❌ Vehicles exist but have NULL coordinates');
        console.log('   → Fix: Backfill coordinates from uvs_data.location.dealer');
      } else if (inBoundsCount === 0) {
        console.log('   ❌ Vehicles have coordinates but are outside bounds');
        console.log('   → Fix: Verify coordinates are correct or adjust bounds');
      } else {
        console.log('   ❌ Vehicles in bounds but availability_status != "available"');
        console.log('   → Fix: Update availability_status or adjust filter');
      }
    } else {
      console.log('✅ Vehicles found! API should return results.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

runDiagnostics();


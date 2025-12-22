#!/usr/bin/env node
/**
 * Backfill script to populate dealer_latitude and dealer_longitude
 * from uvs_data JSONB for vehicles that have NULL coordinates
 * 
 * This script:
 * 1. Finds vehicles with NULL dealer_latitude/dealer_longitude
 * 2. Extracts coordinates from uvs_data.location.dealer.latitude/longitude
 * 3. Updates the database columns
 * 
 * Run: node scripts/backfill-vehicle-coordinates.js
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

async function backfillCoordinates() {
  console.log('=== BACKFILL VEHICLE COORDINATES ===\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Step 1: Find vehicles with NULL coordinates
    console.log('1. Finding vehicles with NULL coordinates...');
    const { data: vehicles, error: fetchError } = await supabase
      .from('uvs_vehicles')
      .select('id, uvs_data, dealer_latitude, dealer_longitude, dealer_id, dealer_name')
      .or('dealer_latitude.is.null,dealer_longitude.is.null')
      .limit(1000); // Process in batches
    
    if (fetchError) {
      console.error(`❌ Error fetching vehicles: ${fetchError.message}`);
      process.exit(1);
    }
    
    if (!vehicles || vehicles.length === 0) {
      console.log('✅ No vehicles with NULL coordinates found. All vehicles have coordinates.\n');
      return;
    }
    
    console.log(`   Found ${vehicles.length} vehicles with NULL coordinates\n`);
    
    // Step 2: Extract coordinates from uvs_data and prepare updates
    console.log('2. Extracting coordinates from uvs_data...');
    const updates = [];
    let extractedCount = 0;
    let missingCount = 0;
    
    for (const vehicle of vehicles) {
      const uvsData = vehicle.uvs_data;
      if (!uvsData || typeof uvsData !== 'object') {
        missingCount++;
        continue;
      }
      
      // Try multiple sources for coordinates (in order of preference):
      // 1. location.dealer (normalized UVS format)
      // 2. dealerDefined.raw.dealer (raw MarketCheck data)
      // 3. enrichment.detail.dealer (enriched MarketCheck data)
      let lat = uvsData.location?.dealer?.latitude;
      let lng = uvsData.location?.dealer?.longitude;
      
      if (lat === undefined || lng === undefined || lat === null || lng === null) {
        // Try dealerDefined.raw
        const raw = uvsData.dealerDefined?.raw;
        if (raw && typeof raw === 'object' && raw.dealer) {
          lat = raw.dealer.latitude;
          lng = raw.dealer.longitude;
        }
      }
      
      if (lat === undefined || lng === undefined || lat === null || lng === null) {
        // Try enrichment.detail
        const detail = uvsData.enrichment?.detail;
        if (detail && typeof detail === 'object' && detail.dealer) {
          lat = detail.dealer.latitude;
          lng = detail.dealer.longitude;
        }
      }
      
      // Parse string coordinates to numbers if needed
      if (typeof lat === 'string') {
        lat = parseFloat(lat);
      }
      if (typeof lng === 'string') {
        lng = parseFloat(lng);
      }
      
      // Validate coordinates
      if (
        lat !== undefined &&
        lng !== undefined &&
        lat !== null &&
        lng !== null &&
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        updates.push({
          id: vehicle.id,
          dealer_latitude: lat,
          dealer_longitude: lng,
        });
        extractedCount++;
      } else {
        missingCount++;
      }
    }
    
    console.log(`   ✅ Extracted coordinates for ${extractedCount} vehicles`);
    console.log(`   ⚠️  ${missingCount} vehicles still missing coordinates (not in uvs_data)\n`);
    
    if (updates.length === 0) {
      console.log('⚠️  No coordinates found in uvs_data. Vehicles may need to be re-synced from MarketCheck.\n');
      return;
    }
    
    // Step 3: Update vehicles in batches
    console.log('3. Updating vehicles in database...');
    const batchSize = 100;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Use upsert to update multiple records
      const updatePromises = batch.map(update =>
        supabase
          .from('uvs_vehicles')
          .update({
            dealer_latitude: update.dealer_latitude,
            dealer_longitude: update.dealer_longitude,
          })
          .eq('id', update.id)
      );
      
      const results = await Promise.all(updatePromises);
      
      results.forEach((result, idx) => {
        if (result.error) {
          console.error(`   ❌ Error updating ${batch[idx].id}: ${result.error.message}`);
          errorCount++;
        } else {
          updatedCount++;
        }
      });
      
      if (i + batchSize < updates.length) {
        process.stdout.write(`   Processed ${Math.min(i + batchSize, updates.length)}/${updates.length}...\r`);
      }
    }
    
    console.log(`\n   ✅ Updated ${updatedCount} vehicles`);
    if (errorCount > 0) {
      console.log(`   ❌ ${errorCount} errors occurred`);
    }
    console.log('');
    
    // Step 4: Verify results
    console.log('4. Verifying results...');
    const { count: remainingNullCount, error: verifyError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .or('dealer_latitude.is.null,dealer_longitude.is.null');
    
    if (verifyError) {
      console.error(`   ❌ Error verifying: ${verifyError.message}`);
    } else {
      console.log(`   Remaining vehicles with NULL coordinates: ${remainingNullCount}`);
      if (remainingNullCount === 0) {
        console.log('   ✅ All vehicles now have coordinates!\n');
      } else {
        console.log(`   ⚠️  ${remainingNullCount} vehicles still need coordinates (may need re-sync)\n`);
      }
    }
    
    // Step 5: Check Rock Hill GMC specifically
    console.log('5. Checking Rock Hill GMC (dealer_id: 11042155)...');
    const { count: rockHillTotal, error: rhTotalError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', '11042155');
    
    const { count: rockHillWithCoords, error: rhCoordsError } = await supabase
      .from('uvs_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', '11042155')
      .not('dealer_latitude', 'is', null)
      .not('dealer_longitude', 'is', null);
    
    if (!rhTotalError && !rhCoordsError) {
      console.log(`   Total vehicles: ${rockHillTotal}`);
      console.log(`   With coordinates: ${rockHillWithCoords}`);
      if (rockHillWithCoords === rockHillTotal) {
        console.log('   ✅ All Rock Hill GMC vehicles have coordinates!\n');
      } else {
        console.log(`   ⚠️  ${rockHillTotal - rockHillWithCoords} vehicles still missing coordinates\n`);
      }
    }
    
    console.log('=== BACKFILL COMPLETE ===\n');
    console.log('Next steps:');
    console.log('1. Re-test the Inventory Search API');
    console.log('2. If coordinates are still missing, vehicles may need to be re-synced from MarketCheck');
    console.log('3. Verify MarketCheck API returns dealer coordinates in response\n');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

backfillCoordinates();


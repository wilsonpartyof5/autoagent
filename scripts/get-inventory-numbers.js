#!/usr/bin/env node

/**
 * Get exact numbers from MarketCheck API sync
 * Shows: fetched, valid, invalid, stored
 */

const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL || 'https://autoagentmcp-server-production.up.railway.app';
const INGESTION_TOKEN = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;
const DEALER_ID = '11042155';
const SOURCE = 'myrockhillgmc.com';

async function getInventoryNumbers() {
  console.log('📊 Getting Exact Inventory Numbers from MarketCheck API');
  console.log('='.repeat(60));
  console.log(`MCP Server: ${MCP_SERVER_URL}`);
  console.log(`Dealer ID: ${DEALER_ID}`);
  console.log(`Source: ${SOURCE}`);
  console.log('');

  const url = `${MCP_SERVER_URL}/api/ingest/marketcheck/fetch-and-ingest`;
  
  const payload = {
    dealerId: DEALER_ID,
    source: SOURCE,
    radiusMiles: 50,
    condition: 'all',
    pageSize: 100,
    page: 1,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (INGESTION_TOKEN) {
    headers['Authorization'] = `Bearer ${INGESTION_TOKEN}`;
  }

  try {
    console.log('📡 Calling MarketCheck fetch-and-ingest API...');
    console.log('');

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON:');
      console.error(responseText);
      return;
    }

    if (!response.ok) {
      console.error(`❌ API Error (${response.status}):`);
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    console.log('✅ API Response Received');
    console.log('='.repeat(60));
    console.log('');

    // Extract numbers
    const fetched = data.fetched || 0;
    const ingestion = data.ingestion || {};
    const summary = ingestion.summary || {};
    
    const valid = summary.valid || 0;
    const invalid = summary.invalid || 0;
    const stored = summary.stored || 0;
    const failed = summary.failed || 0;
    const total = summary.fetched || fetched;

    console.log('📈 BREAKDOWN:');
    console.log('─'.repeat(60));
    console.log(`  1️⃣  MarketCheck API returned: ${fetched} vehicles`);
    console.log(`  2️⃣  UVS Validation:`);
    console.log(`      ✅ Valid (passed validation):    ${valid}`);
    console.log(`      ❌ Invalid (failed validation):  ${invalid}`);
    console.log(`  3️⃣  Database Storage:`);
    console.log(`      💾 Successfully stored:          ${stored}`);
    console.log(`      ⚠️  Failed to store:             ${failed}`);
    console.log('─'.repeat(60));
    console.log('');

    // Analysis
    console.log('🔍 ANALYSIS:');
    console.log('─'.repeat(60));
    
    if (fetched === stored && invalid === 0 && failed === 0) {
      console.log('✅ Perfect sync! All vehicles from MarketCheck passed validation and were stored.');
      console.log(`   MarketCheck API only has ${fetched} vehicles for this dealer.`);
    } else if (fetched > stored) {
      console.log(`⚠️  Some vehicles were filtered out:`);
      console.log(`   • MarketCheck returned: ${fetched} vehicles`);
      console.log(`   • But only ${stored} were stored`);
      
      if (invalid > 0) {
        console.log(`   • ${invalid} failed UVS validation (missing required fields, wrong data types, etc.)`);
      }
      if (failed > 0) {
        console.log(`   • ${failed} failed database storage (database errors)`);
      }
    }
    
    if (invalid > 0) {
      console.log('');
      console.log('❌ Validation Failures:');
      const invalidVehicles = ingestion.invalidVehicles || [];
      if (invalidVehicles.length > 0) {
        invalidVehicles.slice(0, 5).forEach((v, i) => {
          console.log(`   ${i + 1}. Vehicle ID: ${v.vehicleId || 'unknown'}`);
          if (v.error) {
            console.log(`      Error: ${v.error}`);
          }
          if (v.validationErrors && v.validationErrors.length > 0) {
            v.validationErrors.slice(0, 2).forEach(err => {
              console.log(`      - ${err.path || 'unknown'}: ${err.message}`);
            });
          }
        });
        if (invalidVehicles.length > 5) {
          console.log(`   ... and ${invalidVehicles.length - 5} more`);
        }
      }
    }
    
    console.log('─'.repeat(60));
    console.log('');

    // Show full response if requested
    if (process.argv.includes('--full')) {
      console.log('📄 Full API Response:');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error calling API:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

getInventoryNumbers();


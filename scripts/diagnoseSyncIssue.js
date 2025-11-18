/**
 * Diagnose why sync returns 0 vehicles
 * Simulates the exact sync flow to identify the issue
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load env vars manually
const envLocal = fs.readFileSync(path.join(__dirname, '..', 'apps', 'dealer-dashboard', '.env.local'), 'utf8');
const apiKey = envLocal.match(/MARKETCHECK_API_KEY=(.+)/)?.[1]?.trim();

if (!apiKey) {
  console.error('❌ MARKETCHECK_API_KEY not found');
  process.exit(1);
}

const dealerId = '11042155';
const source = 'myrockhillgmc.com';
const baseUrl = 'https://mc-api.marketcheck.com';
const endpoint = '/v2/car/dealer/inventory/active';

// Simulate exact sync logic
const dealerSourceMap = {
  '11042155': 'myrockhillgmc.com',
};

const detectedSource = dealerSourceMap[dealerId] || null;
const useSourceEndpoint = !!detectedSource;

console.log('='.repeat(60));
console.log('Sync Diagnostic Test');
console.log('='.repeat(60));
console.log(`Dealer ID: ${dealerId}`);
console.log(`Detected Source: ${detectedSource}`);
console.log(`Use Source Endpoint: ${useSourceEndpoint}`);
console.log('');

const searchParams = new URLSearchParams({
  api_key: apiKey,
  page: '1',
  pageSize: '100',
});

if (useSourceEndpoint) {
  searchParams.set('source', detectedSource);
  console.log('✅ Using source endpoint');
  console.log(`   Source: ${detectedSource}`);
} else {
  searchParams.set('dealer_id', dealerId);
  console.log('⚠️  Using standard endpoint (should not happen for 11042155)');
}

const finalEndpoint = useSourceEndpoint
  ? '/v2/car/dealer/inventory/active'
  : '/v2/search/car/active';

const url = `${baseUrl}${finalEndpoint}?${searchParams.toString()}`;

console.log('');
console.log('📡 Making API call...');
console.log(`   URL: ${url.replace(apiKey, '***REDACTED***')}`);
console.log('');

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Response received:');
    console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`   Content-Type: ${res.headers['content-type']}`);
    console.log('');
    
    if (res.statusCode !== 200) {
      console.error('❌ API call failed!');
      console.log('Response body:', data.substring(0, 500));
      return;
    }
    
    try {
      const payload = JSON.parse(data);
      const listingsArray = Array.isArray(payload.listings) ? payload.listings : [];
      
      console.log('📊 Response Analysis:');
      console.log(`   num_found: ${payload.num_found ?? 'undefined'}`);
      console.log(`   listings type: ${typeof payload.listings}`);
      console.log(`   listings is array: ${Array.isArray(payload.listings)}`);
      console.log(`   listings.length: ${listingsArray.length}`);
      console.log(`   Response keys: ${Object.keys(payload).join(', ')}`);
      console.log('');
      
      if (listingsArray.length > 0) {
        console.log('✅ Listings found!');
        console.log(`   First VIN: ${listingsArray[0].vin}`);
        console.log(`   First Make: ${listingsArray[0].build?.make}`);
        console.log(`   First Model: ${listingsArray[0].build?.model}`);
      } else {
        console.log('❌ No listings in response!');
        console.log('');
        console.log('🔍 Debugging info:');
        console.log(`   payload.listings value: ${JSON.stringify(payload.listings).substring(0, 200)}`);
        
        // Check for alternative response structure
        if (payload.data && Array.isArray(payload.data)) {
          console.log(`   ⚠️  Found payload.data array with ${payload.data.length} items`);
        }
        if (payload.results && Array.isArray(payload.results)) {
          console.log(`   ⚠️  Found payload.results array with ${payload.results.length} items`);
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e.message);
      console.log('Raw response (first 500 chars):', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error('❌ Request error:', e.message);
});


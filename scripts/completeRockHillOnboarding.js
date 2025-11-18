/**
 * Complete Rock Hill GMC Onboarding Checklist
 * 
 * This script guides you through the complete onboarding process
 * and captures evidence for documentation.
 * 
 * Prerequisites:
 * 1. Database migrations run (scripts/run-all-migrations.sql)
 * 2. Server running (npm run dev)
 * 3. User authenticated in dashboard
 */

const fs = require('fs');
const path = require('path');

const TIMESTAMP = new Date().toISOString();
const DOC_FILE = path.join(__dirname, '..', 'docs', 'marketcheck', 'dealer-sync-ask-jorge-lopez.md');

console.log('='.repeat(60));
console.log('Rock Hill GMC Onboarding Checklist');
console.log('='.repeat(60));
console.log(`Timestamp: ${TIMESTAMP}\n`);

console.log('📋 Checklist:\n');
console.log('✅ Step 1: Database Migrations');
console.log('   - Run: scripts/run-all-migrations.sql in Supabase SQL Editor');
console.log('   - Verify: node scripts/checkDatabaseSchema.js');
console.log('   - Expected: profiles and inventory_vehicles tables exist\n');

console.log('✅ Step 2: Server Running');
console.log('   - Run: cd apps/dealer-dashboard && npm run dev');
console.log('   - Verify: http://localhost:3000 is accessible');
console.log('   - Log file: /tmp/dealer-dashboard-sync.log\n');

console.log('✅ Step 3: User Authentication');
console.log('   - Navigate to: http://localhost:3000/auth');
console.log('   - Sign in or create account');
console.log('   - Verify: User session active\n');

console.log('✅ Step 4: Update Profile');
console.log('   - Navigate to: http://localhost:3000/app/settings');
console.log('   - Set MarketCheck Dealer ID: 11042155');
console.log('   - Set ZIP: 29730');
console.log('   - Click "Save Settings"');
console.log('   - Verify: Success message appears\n');

console.log('✅ Step 5: Run Sync');
console.log('   - Navigate to: http://localhost:3000/app/setup');
console.log('   - Click "Sync MarketCheck Inventory"');
console.log('   - Wait for sync to complete');
console.log('   - Check server logs for: [syncMarketCheckInventory]\n');

console.log('✅ Step 6: Verify Inventory');
console.log('   - Navigate to: http://localhost:3000/app/inventory');
console.log('   - Verify: Rock Hill GMC vehicles appear');
console.log('   - Capture: At least 2 VINs/vehicle names');
console.log('   - Run: node scripts/verifyRockHillInventory.js\n');

console.log('✅ Step 7: Capture Evidence');
console.log('   - Run: ./scripts/captureRockHillSync.sh');
console.log('   - Review: /tmp/rock-hill-sync-*.log');
console.log('   - Update: docs/marketcheck/dealer-sync-ask-jorge-lopez.md\n');

console.log('='.repeat(60));
console.log('Documentation Template');
console.log('='.repeat(60));
console.log('');

const docTemplate = `
## Rock Hill GMC Onboarding – ${TIMESTAMP}

### Step 1: Database Migrations
- **Status**: ✅ Completed
- **Migration File**: \`scripts/run-all-migrations.sql\`
- **Verification**: \`node scripts/checkDatabaseSchema.js\`
- **Result**: Profiles and inventory_vehicles tables exist

### Step 2: Profile Update
- **Dealer ID**: 11042155
- **ZIP**: 29730
- **Method**: Dashboard UI (/app/settings)
- **Status**: ✅ Completed

### Step 3: Sync Execution
- **Timestamp**: ${TIMESTAMP}
- **Dealer ID**: 11042155
- **Source**: myrockhillgmc.com
- **Endpoint**: https://mc-api.marketcheck.com/v2/car/dealer/inventory/active

**Sync Logs**:
\`\`\`
[Paste sync logs from server terminal or /tmp/dealer-dashboard-sync.log]
\`\`\`

**Key Metrics**:
- num_found: [Paste from logs]
- listingsLength: [Paste from logs]
- vehiclesInserted: [Paste from logs]
- normalizationErrors: [Paste from logs]

### Step 4: Inventory Verification
- **Inventory Page**: http://localhost:3000/app/inventory
- **Vehicle Count**: [Paste count]
- **Sample VINs**: 
  - [Paste VIN 1]
  - [Paste VIN 2]

**Verification SQL**:
\`\`\`sql
-- Run in Supabase SQL Editor
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(DISTINCT vin) as unique_vins,
  MIN(created_at) as first_imported,
  MAX(created_at) as last_imported,
  data_source,
  dealer_name
FROM inventory_vehicles
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
  AND dealer_id = '11042155'
GROUP BY data_source, dealer_name;
\`\`\`

**SQL Results**:
\`\`\`
[Paste SQL query results]
\`\`\`

### Step 5: Evidence Files
- **Sync Logs**: /tmp/rock-hill-sync-${TIMESTAMP}.log
- **API Response**: temp/dealer-11042155-inventory.json
- **Verification Script**: scripts/verifyRockHillInventory.js

### Next Steps
- ✅ Inventory imported successfully
- ✅ Dashboard shows Rock Hill GMC vehicles
- ✅ Ready for ChatGPT integration demo

`;

console.log(docTemplate);

console.log('\n💡 To append this template to docs:');
console.log(`   echo '${docTemplate.replace(/'/g, "'\\''")}' >> ${DOC_FILE}`);
console.log('');
console.log('='.repeat(60));


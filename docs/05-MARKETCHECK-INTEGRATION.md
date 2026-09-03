# MarketCheck Integration

**Last Updated**: 2025-02-23  
**Status**: ✅ Active Documentation

> **Source of truth:** Strategy, business model, and how MarketCheck should be used (live MCP/API vs syndication vs future feed) live in [`docs/drevvy/DREVVY_CONTEXT.md`](./drevvy/DREVVY_CONTEXT.md) and [`docs/drevvy/DREVVY_DATA_ARCHITECTURE.md`](./drevvy/DREVVY_DATA_ARCHITECTURE.md). This file is the current implementation/onboarding guide. If they conflict, the Drevvy docs win.

This document consolidates all MarketCheck integration guides, onboarding procedures, sync troubleshooting, and enrichment documentation.

---

## Table of Contents

1. [Current Status](#current-status)
2. [Onboarding Guide](#onboarding-guide)
3. [Multi-Dealership Support](#multi-dealership-support)
4. [Sync Troubleshooting](#sync-troubleshooting)
5. [Enrichment](#enrichment)
6. [Environment Setup](#environment-setup)
7. [Dealer ID Verification](#dealer-id-verification)

---

## Current Status

### Active Test Dealer

- **My Rock Hill GMC** (ID `11042155`, ZIP `29730`, Rock Hill, SC)
- ✅ API verified - source endpoint (`/v2/car/dealer/inventory/active?source=myrockhillgmc.com`) returns 232 vehicles with 10 listings on first page
- ✅ Sync function enhanced to auto-detect source parameter for dealer 11042155
- ✅ Complete guide, SQL scripts, and verification tools created - ready for manual execution

### Previous Dealer

- **Ask Jorge Lopez** (ID `10015450`, ZIP `77375`)
- ⚠️ API returns `num_found: 1298` but empty `listings` array
- Debug logging confirms MarketCheck delivers zero listings to the dashboard flow

### Implementation Status

- ✅ **Sync Function**: Enhanced to auto-detect source parameter for dealer 11042155
- ✅ **Onboarding**: Complete guide, SQL scripts, and verification tools created
- ✅ **Dashboard Flow**: Server running with latest sync code on port 3000
- ✅ **Provider Selector**: Setup screen (`/app/setup`) includes provider selector (MarketCheck, CDK, vAuto). MarketCheck is fully functional; CDK and vAuto show placeholder messaging
- ✅ **Multi-Dealership Support**: Users can manage multiple dealerships and switch between them
- ⏳ **Migrations**: Pending - Run `scripts/run-all-migrations.sql` in Supabase SQL Editor
- ⏳ **Profile Update**: Pending - Update via dashboard UI (`/app/settings` or `/app/setup`) or SQL
- ⏳ **Sync Execution**: Pending - Run sync via dashboard UI (`/app/setup`)
- ⏳ **Inventory Verification**: Pending - Verify after sync completes

---

## Onboarding Guide

### Rock Hill GMC Onboarding

This guide walks through the complete onboarding flow for My Rock Hill GMC (dealer ID: 11042155) to import real MarketCheck inventory into the AutoAgent dealer dashboard.

#### Prerequisites

- ✅ Dashboard server running: `http://localhost:3000`
- ✅ MarketCheck API key configured in `apps/dealer-dashboard/.env.local`
- ✅ Supabase project configured and accessible
- ✅ Browser access to `http://localhost:3000`

#### Step-by-Step Instructions

##### Step 1: Sign In to Dashboard

1. Open browser and navigate to: `http://localhost:3000/auth`
2. Sign in with your account (or create a new test account)
3. Verify you're redirected to `/app/setup` or `/app/dashboard`

##### Step 2: Update Profile Settings

**Option A: Via Dashboard UI (Recommended)**
1. Navigate to: `http://localhost:3000/app/settings`
2. Find the "Inventory Provider" section
3. Set **MarketCheck Dealer ID**: `11042155`
4. Set **ZIP Code**: `29730`
5. Click "Save" or "Update Settings"

**Option B: Via SQL (If UI doesn't work)**
1. Open Supabase SQL Editor
2. Run the following SQL (replace `YOUR_USER_ID` with your actual user ID):

```sql
-- Get your user_id first
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Update profile (replace YOUR_USER_ID with actual ID)
UPDATE profiles
SET 
  marketcheck_dealer_id = '11042155',
  marketcheck_zip = '29730',
  dms_provider = 'marketcheck',
  updated_at = NOW()
WHERE id = 'YOUR_USER_ID';

-- Verify profile was updated
SELECT 
  marketcheck_dealer_id,
  marketcheck_zip,
  dms_provider,
  inventory_connected
FROM profiles
WHERE id = 'YOUR_USER_ID';
```

##### Step 3: Run MarketCheck Sync

1. Navigate to: `http://localhost:3000/app/setup`
2. Verify the dealer ID shows `11042155` (should be auto-populated from profile)
3. Click the **"Sync MarketCheck Inventory"** button
4. Wait for the sync to complete (you'll see a success message)

##### Step 4: Capture Sync Logs

**From Terminal (where server is running):**
1. Look for log entries starting with `[syncMarketCheckInventory]`
2. Capture the following log lines:
   - `Using source endpoint for dealer`
   - `Fetching from MarketCheck`
   - `Response status`
   - `MarketCheck response` (numFound, listingsLength)
   - `First listing sample`
   - `Normalization and mapping complete`
   - `Supabase insert result`
   - `Profile update successful`

##### Step 5: Verify Inventory in Dashboard

1. Navigate to: `http://localhost:3000/app/inventory`
2. Verify you see a grid of GMC vehicles (Sierra, Yukon, etc.)
3. Check that vehicles show:
   - Year, Make, Model
   - VIN
   - Price
   - Mileage
   - Condition (should be "NEW" for Rock Hill GMC)
   - Dealer information

##### Step 6: Verify Inventory in Database

**Option A: Via SQL**
Run the following SQL in Supabase SQL Editor (replace `YOUR_USER_ID` with your user ID):

```sql
-- Count vehicles imported from MarketCheck
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(*) FILTER (WHERE data_source = 'marketcheck-api') as marketcheck_vehicles,
  COUNT(*) FILTER (WHERE dealer_id = '11042155') as rock_hill_vehicles,
  COUNT(DISTINCT make) as makes,
  COUNT(DISTINCT condition) as conditions,
  MIN(year) as min_year,
  MAX(year) as max_year
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID';

-- Sample vehicles
SELECT 
  vin,
  year,
  make,
  model,
  condition,
  price,
  miles,
  dealer_id,
  data_source,
  created_at
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID'
  AND dealer_id = '11042155'
  AND data_source = 'marketcheck-api'
ORDER BY created_at DESC
LIMIT 10;
```

**Option B: Via Script**
Run the verification script:
```bash
cd /Users/mac/AutoAgent
node scripts/verifyRockHillInventory.js
```

### Migration Instructions

#### Quick Start (Consolidated Migration)

Run the consolidated migration script in Supabase SQL Editor:

```bash
# View the migration SQL
cat scripts/run-all-migrations.sql
```

Copy the entire SQL and paste into Supabase SQL Editor, then click "Run".

#### Alternative (Individual Migrations)

If you prefer to run migrations individually:

1. **Create dealerships tables**: `20250223_create_dealerships.sql`
2. **Add dealership_id to inventory**: `20250223_add_dealership_id_to_inventory.sql`
3. **Backfill existing data**: `20250223_backfill_dealerships.sql`

#### Verification

After running migrations, verify:

```sql
-- Check dealerships table exists
SELECT COUNT(*) FROM dealerships;

-- Check user_dealerships table exists
SELECT COUNT(*) FROM user_dealerships;

-- Check user_preferences table exists
SELECT COUNT(*) FROM user_preferences;

-- Check inventory_vehicles has dealership_id column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'inventory_vehicles' AND column_name = 'dealership_id';
```

---

## Multi-Dealership Support

### Overview

The AutoAgent dealer dashboard now supports multi-dealership management, allowing a single user to own and manage multiple dealerships/locations. All inventory, leads, and settings are scoped to the currently selected dealership.

### Key Features

- **Dealership Management**: Each user can own/manage multiple dealerships
- **Store Switcher**: Dropdown in the header to switch between dealerships (always visible, includes "Add Store" option)
- **Scoped Data**: Inventory, leads, and settings are scoped to the active dealership
- **Dealership Name**: Real dealership names replace the "Main Street Dealership" placeholder
- **Onboarding**: Setup form now requires dealership name when syncing inventory
- **Settings Page**: New "Your Stores" section showing all dealerships with status badges (inventory count, lead delivery status)
- **Add Store Modal**: Quick way to add additional dealerships from Settings or header dropdown

### Database Schema

#### `dealerships` table
```sql
- id (uuid, primary key)
- name (text, not null)
- marketcheck_dealer_id (text)
- marketcheck_zip (text)
- logo_url (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `user_dealerships` table
```sql
- user_id (uuid, references auth.users)
- dealership_id (uuid, references dealerships)
- role (text, default 'owner')
- created_at (timestamptz)
- Primary key: (user_id, dealership_id)
```

#### `user_preferences` table
```sql
- user_id (uuid, primary key, references auth.users)
- active_dealership_id (uuid, references dealerships)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `inventory_vehicles` (updated)
```sql
- dealership_id (uuid, references dealerships) -- NEW COLUMN
- ... (other existing columns)
```

### Row Level Security (RLS)

#### Dealerships
- Users can view dealerships they are members of
- Users can update dealerships they own (role = 'owner')
- Users can insert dealerships (membership created separately)

#### User Dealerships
- Users can view their own memberships
- Users can insert their own memberships

#### User Preferences
- Users can view/update their own preferences

#### Inventory Vehicles
- Users can view/insert/update/delete inventory for dealerships they are members of
- Policies check membership via `user_dealerships` table

### Usage

#### Creating a Dealership

- When syncing inventory, users must provide a dealership name. If no active dealership exists, one is created automatically.
- Users can also add stores via the "Add Store" button in Settings or the header dropdown

#### Switching Dealerships

- Use the dropdown in the header (always visible when user has at least one dealership)
- Switching dealerships updates all queries to scope by the new active dealership

#### Multiple Stores

Users can sync inventory for multiple dealerships by:
1. Adding a new store via Settings or header dropdown
2. Clicking "Sync Inventory" for that store (redirects to `/app/setup?dealership=<id>`)
3. Running sync for that specific dealership

#### Settings Page

- View all stores, their status (inventory count, lead delivery configured), and quick actions

### Backfill Behavior

- Existing users automatically get a default dealership created with name from their first inventory vehicle or "Your Dealership"
- All existing inventory is linked to the user's default dealership
- The default dealership is set as the active dealership

### Migration Order

Run migrations in this order (all included in `scripts/run-all-migrations.sql`):
1. Create dealerships tables
2. Add dealership_id to inventory_vehicles
3. Update RLS policies
4. Backfill existing data

---

## Sync Troubleshooting

### Issue: Sync Returns 0 Vehicles But API Test Works

#### Symptoms
- API test script returns vehicles successfully
- Dashboard sync shows "Imported 0 vehicles"
- No error messages in console

#### Root Causes

1. **Validation Error**
   - Vehicle data doesn't match expected schema
   - Missing required fields
   - Invalid data types

2. **Database Schema Missing**
   - Migrations not run
   - Missing columns in `inventory_vehicles` table
   - RLS policies blocking inserts

#### Diagnosis

**Check Database Schema**:
```sql
-- Verify inventory_vehicles table exists
SELECT COUNT(*) FROM inventory_vehicles;

-- Check for required columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'inventory_vehicles';

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'inventory_vehicles';
```

**Check Server Logs**:
- Look for validation errors
- Check for normalization failures
- Verify Supabase insert errors

#### Troubleshooting Steps

1. **Run Migrations**
   ```bash
   # View consolidated migration
   cat scripts/run-all-migrations.sql
   # Run in Supabase SQL Editor
   ```

2. **Refresh Schema Cache**
   - Restart Next.js dev server
   - Clear `.next` cache if needed

3. **Verify Schema**
   ```bash
   node scripts/checkDatabaseSchema.js
   ```

4. **Restart Server**
   ```bash
   pkill -f "next dev"
   pnpm --filter dealer-dashboard dev
   ```

5. **Try Sync Again**
   - Navigate to `/app/setup`
   - Click "Sync MarketCheck Inventory"
   - Watch console for errors

#### Expected Results

After fixing:
- Sync should import vehicles successfully
- Console shows `insertedCount > 0`
- Inventory page shows imported vehicles
- Database contains vehicle records

### Issue: Profile Update Error

**Symptom**: "Unable to update dealer profile" error

**Diagnosis**:
- Check server logs for detailed error messages
- Verify RLS policies allow profile updates
- Check Supabase service role key is configured

**Solution**:
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables
- Verify RLS policies allow updates
- Check profile table exists and has correct columns

### Issue: Zero Vehicles Debug

**Common Causes**:
- MarketCheck API returns empty listings array
- Validation errors during normalization
- Database insert failures
- RLS policy blocking inserts

**Debug Steps**:
1. Test MarketCheck API directly with curl
2. Check server logs for validation errors
3. Verify database schema is correct
4. Test Supabase insert manually

---

## Enrichment

### Overview

Listing enrichment fetches additional detail data from MarketCheck API endpoints to enhance vehicle listings with seller comments, extended photo galleries, option packages, and dealer metadata.

### Enabling Enrichment

Set the environment variable in your server environment:
```bash
MARKETCHECK_ENRICH_LISTINGS=1
```

**Where to set:**
- MCP server: Add to `apps/mcp-server/.env` (affects `search-vehicles` tool)
- Dashboard: Add to `apps/dealer-dashboard/.env.local` (affects inventory sync)

### What Gets Enriched

When enabled, the system fetches:
- **Detail** (`/v2/listing/car/{id}`): Extended listing information
- **Media** (`/v2/listing/car/{id}/media`): Additional photos and video URLs
- **Extra** (`/v2/listing/car/{id}/extra`): Seller comments, option packages, specifications
- **Dealer** (`/v2/dealer/{dealer_id}`): Extended dealer metadata (hours, ratings, etc.)

Merged data appears in:
- Dashboard inventory cards (seller comments, options, enriched photos)
- MCP search responses (ChatGPT can reference seller comments and additional photos)
- Supabase `raw` field (stores original + enriched data for reference)

### Enrichment Test Report

#### Environment Configuration

**Enrichment Flag Setup**:
```bash
# Added to apps/dealer-dashboard/.env.local
MARKETCHECK_ENRICH_LISTINGS=1
```

**Verification**: Flag is set and will be active on next server restart.

#### UI Controls Audit

**Result**: ✅ **No dealer-facing controls exist**

- Enrichment is controlled purely via `process.env.MARKETCHECK_ENRICH_LISTINGS`
- No settings page, toggle, or checkbox exists for dealers
- Dealers cannot enable/disable enrichment themselves

#### Expected Log Output

When enrichment is enabled, you should see:

```json
{
  "event": "inventory_sync",
  "provider": "marketcheck",
  "dealerId": "12345",
  "records": 10,
  "enrichmentEnabled": true,
  "enrichedCount": 8,
  "skippedCount": 2,
  "lastSyncedAt": "2025-02-20T13:52:40.000Z",
  "syncStatus": "success"
}
```

#### UI Display Verification

**Dashboard Inventory Cards (`/app/inventory`)**:
- **Seller Comments**: Muted background box with 2-line truncation, tooltip with full text
- **Option Packages**: Primary-colored badge pills with tooltips
- **Enriched Photos**: Preference order: enrichedPrimaryPhoto → primary_photo_url → thumbnail_url → enrichedPhotos[0] → photo_urls[0]

**ChatGPT Widget (`vehicle-results.html`)**:
- **Seller Comments**: Card view (80 chars), drawer view (4 lines), tooltip with full text
- **Option Packages**: Card view (first 2 + "+N more"), drawer view (all options)
- **Enriched Photos**: Preference: photoUrls[0] (enriched) → vehicle.imageUrl (base) → placeholder

### Troubleshooting

Check structured logs for enrichment events:
- `event: 'search_enrichment'` — MCP search enrichment stats (enrichedCount, photosMerged, featuresMerged)
- `event: 'inventory_sync'` — Dashboard sync stats (enrichmentEnabled, enrichedCount, skippedCount)
- `event: 'marketcheck_enrichment_error'` — Individual listing enrichment failures
- `event: 'marketcheck_enrichment_failed'` — Overall enrichment failure for a listing

**Common issues**:
- **No enrichment data**: Verify `MARKETCHECK_ENRICH_LISTINGS=1` is set and check logs for `enrichmentEnabled: true`
- **Partial enrichment**: Some endpoints may fail (404, rate limits); check for `marketcheck_enrichment_error` events
- **Performance**: Enrichment adds ~3-5 seconds per listing; consider rate limiting for large inventories

---

## Environment Setup

### Required Variables for Dealer Dashboard

```bash
MARKETCHECK_API_KEY=<your-marketcheck-api-key>
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
MARKETCHECK_ENRICH_LISTINGS=1  # Optional: Enable enrichment
```

### Required Variables for MCP Server

```bash
MARKETCHECK_API_KEY=<your-marketcheck-api-key>
MARKETCHECK_BASE_URL=https://marketcheck-prod.apigee.net
MARKETCHECK_ENRICH_LISTINGS=1  # Optional: Enable enrichment
```

### Setup Instructions

1. Copy environment example files:
   ```bash
   cp apps/dealer-dashboard/.env.example apps/dealer-dashboard/.env.local
   cp apps/mcp-server/env.example apps/mcp-server/.env
   ```

2. Add MarketCheck API key to both files

3. (Optional) Enable enrichment by adding `MARKETCHECK_ENRICH_LISTINGS=1`

4. Restart servers to pick up environment variables

### Verification

```bash
# Test MarketCheck API connectivity
curl "https://marketcheck-prod.apigee.net/v2/search/car/active?api_key=YOUR_KEY&location=Seattle,WA&pageSize=1"
```

**Expected Response**: JSON with `listings` array

### Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Rotate API keys periodically
- Monitor API usage for unexpected spikes

### Troubleshooting

**API Key Issues**:
- Verify API key is correct
- Check API key has required permissions
- Verify API key is not expired

**Connection Issues**:
- Check network connectivity
- Verify `MARKETCHECK_BASE_URL` is correct
- Test API endpoint directly with curl

---

## Dealer ID Verification

### Finding Your MarketCheck Dealer ID

#### Prerequisites
- ✅ Active MarketCheck account with signed contract
- ✅ Data feed must be active (vehicles syncing to MarketCheck)
- ✅ API access enabled (if required by your MarketCheck plan)

#### Methods

**Method 1: MarketCheck Dashboard**
1. Log into your MarketCheck dealer portal (URL varies by account; contact MarketCheck if unsure)
2. Navigate to your account settings or dealer profile section
3. Your dealer ID is typically displayed as a numeric value (e.g., `102345`)

**Method 2: Check API Response**
- If you've received inventory data from MarketCheck API before, your dealer ID appears in the `dealer.id` field of any listing response
- Example: `GET /v2/search/car/active?api_key=...&location=Seattle,WA` returns listings with `dealer.id` values

**Method 3: Contact MarketCheck Support**
- If you cannot locate your dealer ID, contact MarketCheck support:
  - **Email**: support@marketcheck.com
  - **Support Center**: [MarketCheck Support](https://www.marketcheck.com/apis/pricing/)
- Provide your dealership name and location to expedite lookup

### Verification Status

**Current Implementation**:
- ✅ Manual dealer ID entry required (no programmatic lookup)
- ✅ Dealer ID is required for AutoAgent inventory sync
- ✅ ZIP/radius are optional refinements, not replacements for dealer ID

**Open Questions**:
- ⚠️ MarketCheck Portal URL: Portal URL varies by account
- ⚠️ Exact Location of Dealer ID: Needs verification with MarketCheck or test dealer account
- ⚠️ Dealer ID Lookup API Endpoint: Not verified if exists
- ⚠️ Geographic Search Without Dealer ID: Not verified if possible

### Rooftop Auto-Detection

**Status**: ✅ Implemented

**How it works**:
- Dealer ID entry triggers auto-detection
- UI flow guides dealer through confirmation
- Profile persistence stores confirmed rooftop/ZIP
- Sync action integration uses confirmed values

**Testing**:
- Enter dealer ID in setup form
- Verify rooftop detection works
- Confirm profile persistence
- Test sync with detected values

---

## Demo Workaround

**Strategy**: Seed demo inventory directly into Supabase to enable end-to-end testing without MarketCheck.

**Implementation**:
- 10 realistic vehicles inserted with `data_source = 'seed-demo'`
- Mix of new/used conditions and body styles (Sedan, SUV, Pickup, Coupe)
- All tagged with dealer_id='10015450' for consistency
- SQL script: `scripts/seed-demo-inventory.sql`

**Result**: Dashboard can now show inventory and accept leads even though MarketCheck returns zero listings.

**Next Steps**:
1. **For Demo**: Use seeded inventory to test search and lead submission workflows
2. **For Production**: 
   - Contact MarketCheck support about API inconsistency (`num_found: 1298` but `listings: []`)
   - Request working dealer ID or feed status confirmation
   - Once resolved, re-run sync and verify MarketCheck vehicles import correctly
3. **Alternative**: Switch to a different dealer ID known to have active inventory

---

## Helpful Files

- `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` – Full timeline, curl output, SQL queries, and Rock Hill GMC validation details
- `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` – **Step-by-step onboarding guide for Rock Hill GMC**
- `docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md` – **Complete onboarding summary and quick reference**
- `docs/marketcheck/ONBOARDING_EXECUTION_LOG.md` – Execution log template for tracking progress
- `docs/marketcheck/MIGRATION_INSTRUCTIONS.md` – Database migration instructions
- `docs/marketcheck/SYNC_TROUBLESHOOTING.md` – Troubleshooting guide for sync issues
- `scripts/run-all-migrations.sql` – **Consolidated migration script (run in Supabase SQL Editor)**
- `scripts/testRockHillGMC.js` – Test MarketCheck API with source parameter
- `scripts/rock-hill-onboarding.sql` – SQL script for profile update and inventory verification
- `scripts/verifyRockHillInventory.js` – Verification script for imported inventory
- `scripts/captureRockHillSync.sh` – Script to capture sync logs
- `scripts/completeRockHillOnboarding.js` – Onboarding checklist and documentation template
- `scripts/checkDatabaseSchema.js` – Schema verification script
- `scripts/seed-demo-inventory.sql` – SQL to seed demo inventory for testing

---

## Next Steps

1. **Complete Rock Hill GMC Onboarding**:
   - Follow onboarding guide above
   - Sign in at `http://localhost:3000/auth`
   - Navigate to `/app/setup` and select **MarketCheck** as your inventory provider
   - Enter dealer_id=11042155, ZIP=29730
   - Run sync at `/app/setup`
   - Verify inventory in `/app/inventory`
   - Use the new filter UI to slice inventory by condition, body type, price range, days on lot, and enrichment flags
   - Document sync logs and SQL results

2. **Update Documentation**:
   - Fill in sync execution results
   - Update status with vehicle count and sample VINs
   - Update integration readiness status

3. **Test ChatGPT Integration**:
   - Verify MCP handshake with real inventory
   - Test vehicle search with Rock Hill GMC vehicles
   - Test lead submission with imported vehicles

---

**Related Documentation**:
- Core Documentation: `docs/01-CORE-DOCUMENTATION.md`
- API Reference: `docs/03-API-INTEGRATION.md`
- Testing Guide: `docs/04-TESTING-QUALITY.md`


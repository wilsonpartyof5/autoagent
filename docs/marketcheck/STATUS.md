# MarketCheck Sync Status (2025-02-23)

## Current Situation
- **Active test dealer**: **My Rock Hill GMC** (ID `11042155`, ZIP `29730`, Rock Hill, SC).
- **Previous dealer**: Ask Jorge Lopez (ID `10015450`, ZIP `77375`) - API returns `num_found: 1298` but empty `listings` array.
- **Rock Hill GMC status**: ✅ API verified - source endpoint (`/v2/car/dealer/inventory/active?source=myrockhillgmc.com`) returns 232 vehicles with 10 listings on first page.
- **Sync function**: ✅ Enhanced to auto-detect source parameter for dealer 11042155.
- **Onboarding**: ✅ Complete guide, SQL scripts, and verification tools created - ready for manual execution.
- **Dashboard flow**: ✅ Server running with latest sync code on port 3000 - ready for profile update and sync execution.
- **Provider selector**: ✅ Setup screen (`/app/setup`) now includes provider selector (MarketCheck, CDK, vAuto). MarketCheck is fully functional; CDK and vAuto show placeholder messaging.
- **Multi-Dealership Support**: ✅ **NEW** - Users can now manage multiple dealerships and switch between them in the dashboard header. Inventory, leads, and settings are scoped to the selected dealership.
- **Migrations**: ⏳ Pending - Run `scripts/run-all-migrations.sql` in Supabase SQL Editor (includes dealership tables).
- **Profile Update**: ⏳ Pending - Update via dashboard UI (`/app/settings` or `/app/setup`) or SQL.
- **Sync Execution**: ⏳ Pending - Run sync via dashboard UI (`/app/setup`).
- **Inventory Verification**: ⏳ Pending - Verify after sync completes.

## Evidence

### My Rock Hill GMC (2025-02-21)
- ✅ **API Test**: `scripts/testRockHillGMC.js` - 232 vehicles found, 10 listings returned
- ✅ **Response Saved**: `temp/dealer-11042155-inventory.json`
- ✅ **Sync Enhancement**: Auto-detection for source parameter in `syncMarketCheckInventory`
- ✅ **Onboarding Guide**: `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` created
- ✅ **SQL Scripts**: `scripts/rock-hill-onboarding.sql` created
- ✅ **Verification Script**: `scripts/verifyRockHillInventory.js` created
- ✅ **Migration Script**: `scripts/run-all-migrations.sql` created (consolidated)
- ✅ **Server**: Running with latest sync code on port 3000 (HTTP 200)
- ✅ **Log Capture**: `scripts/captureRockHillSync.sh` created
- ✅ **Onboarding Summary**: `docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md` created
- ✅ **Execution Log**: `docs/marketcheck/ONBOARDING_EXECUTION_LOG.md` created
- ⏳ **Migrations**: Manual execution required (see `docs/marketcheck/MIGRATION_INSTRUCTIONS.md`)
- ⏳ **Profile Update**: Manual execution required (see onboarding guide)
- ⏳ **Sync Execution**: Manual execution required (see onboarding guide)
- ⏳ **Inventory Verification**: Pending sync completion

**Full details**: `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` ("My Rock Hill GMC Validation – 2025-02-21T20:00:00Z")

**Next Step**: Follow `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` to complete onboarding

## Multi-Dealership Feature (2025-02-23)

### Overview
The dashboard now supports multiple dealerships per user, allowing dealers to manage multiple locations/stores from a single account. This feature is **fully implemented and ready for use**.

### Key Features
- **Dealership Management**: Each user can own/manage multiple dealerships
- **Store Switcher**: Dropdown in the header to switch between dealerships (always visible, includes "Add Store" option)
- **Scoped Data**: Inventory, leads, and settings are scoped to the active dealership
- **Dealership Name**: Real dealership names replace the "Main Street Dealership" placeholder
- **Onboarding**: Setup form now requires dealership name when syncing inventory
- **Settings Page**: New "Your Stores" section showing all dealerships with status badges (inventory count, lead delivery status)
- **Add Store Modal**: Quick way to add additional dealerships from Settings or header dropdown

### Database Schema
- **`dealerships` table**: Stores dealership information (name, MarketCheck ID, ZIP, logo)
- **`user_dealerships` table**: Junction table linking users to dealerships with roles
- **`user_preferences` table**: Stores the active dealership ID for each user
- **`inventory_vehicles` table**: Updated with `dealership_id` column (replaces user-only scoping)

### Migrations
1. **20250223_create_dealerships.sql**: Creates dealerships, user_dealerships, and user_preferences tables
2. **20250223_add_dealership_id_to_inventory.sql**: Adds dealership_id to inventory_vehicles and updates RLS policies
3. **20250223_backfill_dealerships.sql**: Creates default dealerships for existing users and links their inventory

### Migration Order
Run migrations in this order (all included in `scripts/run-all-migrations.sql`):
1. Create dealerships tables
2. Add dealership_id to inventory_vehicles
3. Update RLS policies
4. Backfill existing data

### Usage
- **Creating a Dealership**: 
  - When syncing inventory, users must provide a dealership name. If no active dealership exists, one is created automatically.
  - Users can also add stores via the "Add Store" button in Settings or the header dropdown
- **Switching Dealerships**: Use the dropdown in the header (always visible when user has at least one dealership)
- **Multiple Stores**: Users can sync inventory for multiple dealerships by:
  1. Adding a new store via Settings or header dropdown
  2. Clicking "Sync Inventory" for that store (redirects to `/app/setup?dealership=<id>`)
  3. Running sync for that specific dealership
- **Settings Page**: View all stores, their status (inventory count, lead delivery configured), and quick actions

### Backfill Behavior
- Existing users automatically get a default dealership created with name from their first inventory vehicle or "Your Dealership"
- All existing inventory is linked to the user's default dealership
- The default dealership is set as the active dealership

### RLS Policies
- Users can only view/update dealerships they are members of
- Inventory queries are scoped by dealership_id (not user_id)
- Users can only access inventory for dealerships they belong to

### Ask Jorge Lopez (Previous)
- Test script output: `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` ("Headless Investigation – 2025-02-21T18:20:00Z").
- Debug logging in `syncMarketCheckInventory` confirms MarketCheck delivers zero listings to the dashboard flow.
- Supabase queries show no rows for dealer `10015450` (expected because MarketCheck returned none).

## Pending Actions
1. **MarketCheck follow-up** – Share the `num_found` vs `listings` mismatch with MarketCheck support and ask them to confirm the dealer's feed status or provide a working dealer ID.
2. **Positive test** – Use a dealer ID known to have active listings (any of the ones discovered via scripts) to capture a successful `/app/inventory` screenshot and log for documentation.
3. **API route improvement (optional)** – Update `/api/inventory/sync` to accept a `userId` and use the service-role key so stateless calls can run without the UI session.
4. **New lead from MarketCheck (2025-02-21)** – Support confirmed that **My Rock Hill GMC** is live in their database with `mc_website_id = 11042155` and can be queried via:
   ```
   https://mc-api.marketcheck.com/v2/car/dealer/inventory/active?api_key=YOUR_KEY&source=myrockhillgmc.com
   ```
   We should run `scripts/testDealerSync.js` (or a quick curl) against this source to confirm listings return, then feed that dealer ID/source into the dashboard sync as our positive test candidate.

## Demo Workaround (2025-02-21)

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
3. **Alternative**: Switch to a different dealer ID known to have active inventory (from earlier search results)

## Helpful Files
- `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` – Full timeline, curl output, SQL queries, and Rock Hill GMC validation details.
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

## Next Steps

1. **Complete Rock Hill GMC Onboarding**:
   - Follow `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md`
   - Sign in at `http://localhost:3000/auth`
   - Navigate to `/app/setup` and select **MarketCheck** as your inventory provider
   - Enter dealer_id=11042155, ZIP=29730
   - Run sync at `/app/setup`
   - Verify inventory in `/app/inventory`
   - Use the new filter UI to slice inventory by condition, body type, price range, days on lot, and enrichment flags
   - Document sync logs and SQL results

2. **Update Documentation**:
   - Fill in sync execution results in `dealer-sync-ask-jorge-lopez.md`
   - Update this STATUS.md with vehicle count and sample VINs
   - Update `CHATGPT_INTEGRATION_READY.md` with inventory status

3. **Test ChatGPT Integration**:
   - Verify MCP handshake with real inventory
   - Test vehicle search with Rock Hill GMC vehicles
   - Test lead submission with imported vehicles

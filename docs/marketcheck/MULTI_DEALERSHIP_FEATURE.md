# Multi-Dealership Feature Documentation

**Date**: 2025-02-23  
**Status**: ✅ **Implemented**

## Overview

The Drevvy dealer dashboard now supports multi-dealership management, allowing a single user to own and manage multiple dealerships/locations. All inventory, leads, and settings are scoped to the currently selected dealership.

## Key Features

### 1. Dealership Management
- Users can own/manage multiple dealerships
- Each dealership has its own name, MarketCheck dealer ID, ZIP code, and optional logo
- Dealerships are linked to users via the `user_dealerships` junction table

### 2. Store Switcher
- Dropdown in the dashboard header to switch between dealerships
- Only appears when the user has 2+ dealerships
- Shows the active dealership name in the header
- Switching dealerships updates all queries to scope by the new active dealership

### 3. Scoped Data
- **Inventory**: All inventory queries are scoped by `dealership_id` (not `user_id`)
- **Leads**: Lead queries are scoped to the active dealership
- **Settings**: Dealership-specific settings (MarketCheck ID, ZIP) are stored per dealership

### 4. Onboarding Updates
- Setup form (`/app/setup`) now requires a dealership name
- When syncing inventory, users must provide:
  - Dealership name (required)
  - MarketCheck dealer ID (required)
  - ZIP code (optional, but recommended)
- If no active dealership exists, one is created automatically during sync

## Database Schema

### Tables

#### `dealerships`
```sql
- id (uuid, primary key)
- name (text, not null)
- marketcheck_dealer_id (text)
- marketcheck_zip (text)
- logo_url (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `user_dealerships`
```sql
- user_id (uuid, references auth.users)
- dealership_id (uuid, references dealerships)
- role (text, default 'owner')
- created_at (timestamptz)
- Primary key: (user_id, dealership_id)
```

#### `user_preferences`
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

## Migrations

### Migration Files
1. `20250223_create_dealerships.sql` - Creates dealerships, user_dealerships, and user_preferences tables
2. `20250223_add_dealership_id_to_inventory.sql` - Adds dealership_id to inventory_vehicles and updates RLS policies
3. `20250223_backfill_dealerships.sql` - Creates default dealerships for existing users

### Migration Order
All migrations are included in `scripts/run-all-migrations.sql` and should be run in order:

1. Create dealerships tables
2. Add dealership_id column to inventory_vehicles
3. Update RLS policies for inventory_vehicles
4. Backfill existing data

### Backfill Logic
The backfill migration:
1. Loops through all users with profiles
2. Creates a default dealership for each user:
   - Name: Uses dealer_name from first inventory vehicle, or "Your Dealership"
   - MarketCheck ID/ZIP: From user's profile
3. Links user to dealership in `user_dealerships` (role: 'owner')
4. Sets dealership as active in `user_preferences`
5. Updates all existing inventory_vehicles to use the new dealership_id

## API Changes

### Server Actions

#### `syncMarketCheckInventory`
- Now accepts `dealershipName` parameter
- Creates or updates the active dealership with MarketCheck info
- Links all synced inventory to the active dealership (via `dealership_id`)
- Deletes existing inventory for the active dealership before inserting new records

#### `switchDealership` (new)
- Server action to change the active dealership
- Updates `user_preferences.active_dealership_id`
- Revalidates all app paths

### Helper Functions

#### `fetchUserDealerships()`
- Returns all dealerships for the current user
- Used to populate the store switcher dropdown

#### `getActiveDealership()`
- Returns the active dealership for the current user
- If no active dealership exists, returns the first available dealership
- Used throughout the app to get dealership context

#### `getActiveDealershipId()`
- Returns the active dealership ID for the current user
- Used in server-side queries to scope data

#### `createDealership(payload)`
- Creates a new dealership and links it to the current user
- Sets as active if it's the user's first dealership

#### `updateDealership(dealershipId, payload)`
- Updates an existing dealership
- Only allowed for owners of the dealership

#### `setActiveDealership(dealershipId)`
- Sets the active dealership for the current user
- Verifies user has access to the dealership

## UI Changes

### Header Component
- Shows dealership name (or "Your Dealership" if none)
- Displays dropdown switcher when user has 2+ dealerships
- Switcher calls `switchDealership` action on change
- Refreshes page data after switching

### Setup Form
- Added "Dealership name" field (required)
- Pre-fills with active dealership name if available
- Validates dealership name before allowing sync

### Inventory Page
- Queries scoped by `dealership_id` instead of `user_id`
- Shows empty state if no active dealership exists
- Filters and body type queries also scoped by dealership

### App Layout
- Fetches user's dealerships and active dealership server-side
- Passes dealership data to header component

## Usage Examples

### Creating a New Dealership
1. Navigate to `/app/setup`
2. Enter dealership name, MarketCheck dealer ID, and ZIP
3. Click "Sync MarketCheck Inventory"
4. A new dealership is created and set as active
5. Inventory is linked to this dealership

### Adding a Second Dealership
1. Navigate to `/app/setup`
2. Enter new dealership name, MarketCheck dealer ID, and ZIP
3. Click "Sync MarketCheck Inventory"
4. A new dealership is created
5. The store switcher appears in the header
6. Switch between dealerships to manage each separately

### Switching Dealerships
1. Click the dealership name in the header (if 2+ dealerships exist)
2. Select a different dealership from the dropdown
3. Page refreshes with data for the selected dealership
4. All inventory, leads, and settings are now scoped to the new dealership

## Testing

### Test Scenarios
1. **Single Dealership**: User with one dealership should see name in header (no switcher)
2. **Multiple Dealerships**: User with 2+ dealerships should see dropdown switcher
3. **Inventory Scoping**: Switching dealerships should show different inventory
4. **Sync Scoping**: Syncing inventory should only affect the active dealership
5. **Backfill**: Existing users should have a default dealership created automatically

### Validation
- Run migrations locally or via Supabase SQL Editor
- Create two dealerships for a single user
- Verify switcher appears and works correctly
- Confirm inventory is scoped correctly for each dealership
- Verify MarketCheck sync respects active dealership

## Migration Notes

### For Existing Users
- Existing users will have a default dealership created automatically
- All existing inventory is linked to the default dealership
- The default dealership is set as active
- Users can continue using the dashboard as before (no breaking changes)

### For New Users
- New users must provide a dealership name when first syncing inventory
- A dealership is created automatically during the first sync
- Subsequent syncs update the existing dealership

## Future Enhancements

### Potential Improvements
- **Dealership Settings Page**: Dedicated page to manage dealership details
- **Dealership Roles**: Support for multiple roles (owner, manager, viewer)
- **Dealership Sharing**: Allow users to share dealerships with other users
- **Dealership Analytics**: Per-dealership analytics and reporting
- **Bulk Operations**: Sync inventory for multiple dealerships at once

## Related Files

### Migration Files
- `apps/dealer-dashboard/supabase/migrations/20250223_create_dealerships.sql`
- `apps/dealer-dashboard/supabase/migrations/20250223_add_dealership_id_to_inventory.sql`
- `apps/dealer-dashboard/supabase/migrations/20250223_backfill_dealerships.sql`
- `scripts/run-all-migrations.sql` (consolidated)

### Code Files
- `apps/dealer-dashboard/src/lib/supabase/dealerships.ts` (helper functions)
- `apps/dealer-dashboard/src/app/app/actions/dealership.ts` (server actions)
- `apps/dealer-dashboard/src/components/dashboard/app-header.tsx` (switcher UI)
- `apps/dealer-dashboard/src/app/app/setup/actions.ts` (sync updates)
- `apps/dealer-dashboard/src/app/app/inventory/page.tsx` (scoped queries)
- `apps/dealer-dashboard/src/app/app/layout.tsx` (dealership data fetching)

## Troubleshooting

### Common Issues

#### "No active dealership" error
- **Cause**: User has no dealerships or active dealership is null
- **Solution**: Run backfill migration or create a dealership via setup form

#### Inventory not showing after switching dealerships
- **Cause**: Inventory is scoped to dealership_id, but RLS policies may be blocking access
- **Solution**: Verify user is a member of the dealership in `user_dealerships` table

#### Switcher not appearing
- **Cause**: User has less than 2 dealerships
- **Solution**: Create a second dealership via setup form

#### Sync affecting wrong dealership
- **Cause**: Active dealership not set correctly
- **Solution**: Verify `user_preferences.active_dealership_id` is correct

## Support

For issues or questions about the multi-dealership feature:
1. Check migration logs for errors
2. Verify RLS policies are correctly applied
3. Check user_dealerships table for membership records
4. Verify user_preferences table has active_dealership_id set
5. Contact support@drevvy.com for assistance


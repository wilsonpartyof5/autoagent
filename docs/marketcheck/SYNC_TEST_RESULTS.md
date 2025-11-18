# MarketCheck Sync Test Results

## Environment Configuration (2025-11-07)

### Issue Resolved
**Problem**: "MarketCheck API key is not configured on the server" error when attempting sync

**Root Cause**: `MARKETCHECK_API_KEY` was missing from `apps/dealer-dashboard/.env.local`

**Solution Applied**:
1. Added `MARKETCHECK_API_KEY=MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX` to `apps/dealer-dashboard/.env.local`
2. Restarted dealer dashboard dev server
3. Verified server health check passing

**Files Modified**:
- `apps/dealer-dashboard/.env.local` - Added MARKETCHECK_API_KEY

**Documentation Created**:
- `docs/marketcheck/env-setup.md` - Complete environment variable setup guide

## "Fetch Failed" Error Diagnosis (2025-11-07)

### Issue
**Problem**: "MarketCheck error: fetch failed" when attempting sync on `/app/setup`

**Symptoms**:
- Dealer ID entered: `10015450`
- Click "Sync Inventory"
- Error banner: "MarketCheck error: fetch failed"

### Root Cause Analysis

#### 1. API Endpoint Testing

**Test 1: Default Base URL (marketcheck-prod.apigee.net)**
```bash
curl "https://marketcheck-prod.apigee.net/v2/search/car/active?api_key=...&dealer_id=10015450&pageSize=1"
```
**Result**: ❌ **Connection Failed** (HTTP Status: 000)
- Domain `marketcheck-prod.apigee.net` is unreachable
- DNS resolution or network connectivity issue

**Test 2: Alternative Base URL (api.marketcheck.com)**
```bash
curl "https://api.marketcheck.com/v2/search/car/active?api_key=...&dealer_id=10015450&pageSize=1"
```
**Result**: ✅ **Success** (HTTP Status: 200)
```json
{"num_found":1298,"listings":[]}
```

#### 2. Code Analysis

**Default Base URL in Code**:
```typescript
const MARKETCHECK_DEFAULT_BASE = 'https://marketcheck-prod.apigee.net';
```

**Issue**: The default base URL points to an unreachable domain.

**Environment Variable Check**:
- `MARKETCHECK_BASE_URL` was not set in `.env.local`
- Code falls back to default: `marketcheck-prod.apigee.net`
- This domain fails to connect

#### 3. Enhanced Logging Added

Added detailed logging to `syncMarketCheckInventory` to capture:
- Request URL (with API key redacted)
- Response status and headers
- Error details including stack traces
- Response payload details

**Logging Output** (when error occurs):
```
[syncMarketCheckInventory] Fetching from MarketCheck: {
  url: 'https://marketcheck-prod.apigee.net/v2/search/car/active?api_key=***REDACTED***&dealer_id=10015450&pageSize=100',
  baseUrl: 'https://marketcheck-prod.apigee.net',
  dealerId: '10015450',
  zip: '77375',
  hasApiKey: true
}

[syncMarketCheckInventory] Fetch error: {
  error: 'fetch failed',
  name: 'TypeError',
  stack: '...'
}
```

### Root Cause

**Primary Issue**: Default base URL `marketcheck-prod.apigee.net` is unreachable

**Contributing Factors**:
1. `MARKETCHECK_BASE_URL` environment variable not set
2. Code defaults to unreachable domain
3. Generic error message "fetch failed" doesn't indicate DNS/network issue

### Solution Applied

**Fix 1: Update Default Base URL**
- Changed `MARKETCHECK_DEFAULT_BASE` from `https://marketcheck-prod.apigee.net` to `https://api.marketcheck.com`
- File: `apps/dealer-dashboard/src/app/app/setup/actions.ts`

**Fix 2: Set Environment Variable**
- Added `MARKETCHECK_BASE_URL=https://api.marketcheck.com` to `.env.local`
- File: `apps/dealer-dashboard/.env.local`

**Fix 3: Enhanced Error Logging**
- Added detailed logging around fetch calls
- Captures URL, status, headers, and error details
- Helps diagnose future issues faster

### Verification

**Before Fix**:
- ❌ `marketcheck-prod.apigee.net` - Connection failed
- ✅ `api.marketcheck.com` - Works correctly

**After Fix**:
- ✅ Default base URL updated to `api.marketcheck.com`
- ✅ Environment variable set
- ✅ Server needs restart to load new env var

### Testing Steps

1. **Restart Server**:
   ```bash
   # Kill existing server
   lsof -ti:3000 | xargs kill -9
   
   # Restart
   pnpm --filter dealer-dashboard dev
   ```

2. **Test Sync**:
   - Navigate to `http://localhost:3000/app/setup`
   - Enter Dealer ID: `10015450`
   - Verify rooftop auto-detects
   - Click "Sync Inventory"
   - Should succeed (no "fetch failed" error)

3. **Check Server Logs**:
   - Look for `[syncMarketCheckInventory]` log entries
   - Should show successful fetch to `api.marketcheck.com`
   - Should show response with listings count

### Expected Console Log (After Fix)

```json
{
  "event": "inventory_sync",
  "provider": "marketcheck",
  "dealerId": "10015450",
  "records": 3,
  "enrichmentEnabled": true,
  "enrichedCount": 0,
  "skippedCount": 3,
  "lastSyncedAt": "2025-11-07T...",
  "syncStatus": "success"
}
```

### Documentation Updates

**Files Updated**:
- `docs/marketcheck/SYNC_TEST_RESULTS.md` - This file with diagnosis
- `apps/dealer-dashboard/src/app/app/setup/actions.ts` - Updated default base URL and added logging
- `apps/dealer-dashboard/.env.local` - Added MARKETCHECK_BASE_URL

**Recommendation**: Update `docs/api/marketcheck-endpoints.md` to reflect correct base URL (`api.marketcheck.com` instead of `marketcheck-prod.apigee.net`)

## Current Configuration

### Environment Variables Set
```env
# apps/dealer-dashboard/.env.local
MARKETCHECK_API_KEY=MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX
MARKETCHECK_BASE_URL=https://api.marketcheck.com
MARKETCHECK_ENRICH_LISTINGS=1
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Server Status
- ✅ Dealer dashboard running on `http://localhost:3000`
- ✅ Health check endpoint responding
- ✅ Environment variables configured
- ⚠️ **Server restart required** to load MARKETCHECK_BASE_URL

## Summary

### Issues Found and Fixed

1. ✅ **API Key Missing**: Fixed by adding to `.env.local`
2. ✅ **Wrong Base URL**: Fixed by updating default and setting env var
3. ✅ **Poor Error Logging**: Fixed by adding detailed logging

### Next Steps

1. Restart server to load new `MARKETCHECK_BASE_URL`
2. Test sync flow end-to-end
3. Verify vehicles appear in `/app/inventory`
4. Capture screenshots and console logs
5. Update `dealer-sync-ask-jorge-lopez.md` with results

### Root Cause Summary

**"Fetch failed" error was caused by**:
- Default base URL `marketcheck-prod.apigee.net` being unreachable
- Missing `MARKETCHECK_BASE_URL` environment variable
- Generic error message masking the DNS/network issue

**Fix**: Updated default base URL to `api.marketcheck.com` (which works) and set environment variable for explicit configuration.

---

## Profile Update Failure (2025-11-07)

### Issue
**Problem**: "Unable to update dealer profile" error banner appears after sync completes

**Symptoms**:
- Sync appears to complete successfully (vehicles imported)
- Red error banner shows: "Unable to update dealer profile. Please try again."
- Inventory sync succeeds but profile update fails

### Enhanced Logging Added

**Files Modified**:
1. `apps/dealer-dashboard/src/app/app/setup/actions.ts`
   - Added try/catch around `updateDealerProfile` call
   - Logs profile update attempt and failure details
   - Does NOT throw error (allows sync to complete even if profile update fails)

2. `apps/dealer-dashboard/src/lib/supabase/profile.ts`
   - Added detailed logging before/after Supabase upsert
   - Logs payload, error details (code, message, hint), and result

### Expected Log Output

When profile update fails, you should see these log entries in the server console:

```
[syncMarketCheckInventory] Updating dealer profile: {
  dealerId: '10015450',
  zip: '77375',
  inventoryConnected: true,
  userId: '...'
}

[profiles] Attempting to update profile: {
  userId: '...',
  fields: ['dms_provider', 'marketcheck_dealer_id', 'marketcheck_zip', 'inventory_connected'],
  payload: { id: '...', updated_at: '...', ... }
}

[profiles] Profile update result: {
  success: false,
  error: {
    message: '...',
    code: '...',
    details: '...',
    hint: '...'
  },
  data: null
}

[profiles] failed to update profile: {
  error: {
    message: '...',
    code: '...',
    details: '...',
    hint: '...',
    status: ...
  },
  payload: { id: '...', fields: [...] }
}

[syncMarketCheckInventory] Profile update failed: {
  error: 'Unable to update dealer profile. Please try again.',
  stack: '...',
  name: 'Error',
  userId: '...',
  dealerId: '10015450',
  zip: '77375'
}
```

### Possible Root Causes

Based on RLS policies in `20250219_add_profiles_table.sql`:

1. **RLS Policy Issue**: 
   - UPDATE policy: `using (auth.uid() = id)` ✅ Should work
   - INSERT policy: `with check (auth.uid() = id)` ✅ Should work
   - But `upsert` might have issues if profile doesn't exist

2. **Authentication Context**:
   - Server action might not have proper auth context
   - `createClient()` from `@/lib/supabase/server` should handle this

3. **Missing Profile Row**:
   - If profile doesn't exist, `upsert` tries INSERT
   - INSERT might fail if RLS policy doesn't allow it
   - Or trigger might conflict

4. **Column Permissions**:
   - `marketcheck_dealer_id` and `marketcheck_zip` columns added via migration
   - RLS policies might not cover these new columns

### Testing Steps

1. **Reproduce Error**:
   - Navigate to `http://localhost:3000/app/setup`
   - Enter dealer ID: `10015450`
   - Click "Sync MarketCheck Inventory"
   - Wait for error banner

2. **Capture Server Logs**:
   - Check terminal running `pnpm --filter dealer-dashboard dev`
   - Look for `[profiles]` and `[syncMarketCheckInventory]` log entries
   - Copy complete error object including code, message, details, hint

3. **Check Browser Network Tab**:
   - Open DevTools → Network
   - Look for failed request (might be a server action call)
   - Check response body for error details

4. **Verify Profile Exists**:
   - Check Supabase dashboard
   - Query: `SELECT * FROM profiles WHERE id = '<user_id>';`
   - Verify user has a profile row

### Next Steps

After capturing the error:
1. Document exact error code and message
2. Check if profile row exists for the user
3. Verify RLS policies are correctly applied
4. Test if INSERT vs UPDATE makes a difference
5. Check if `upsert` is the right operation (maybe need separate INSERT/UPDATE logic)

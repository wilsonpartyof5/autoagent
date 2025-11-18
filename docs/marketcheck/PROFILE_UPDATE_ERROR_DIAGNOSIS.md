# Profile Update Error Diagnosis

## Issue Summary

**Error Message**: "Unable to update dealer profile. Please try again."
**Location**: Appears after sync completes on `/app/setup`
**Status**: ⚠️ **Enhanced logging added, ready for error capture**

## Changes Made

### 1. Enhanced Logging in Sync Action

**File**: `apps/dealer-dashboard/src/app/app/setup/actions.ts`

**Changes**:
- Wrapped `updateDealerProfile` call in try/catch
- Logs profile update attempt with dealerId, zip, userId
- Logs profile update failure with full error details
- **Does NOT throw error** - allows sync to complete even if profile update fails

**Code Added**:
```typescript
try {
  console.log('[syncMarketCheckInventory] Updating dealer profile:', {
    dealerId,
    zip: zip ?? null,
    inventoryConnected: records.length > 0,
    userId: user.id,
  });

  await updateDealerProfile({...});

  console.log('[syncMarketCheckInventory] Profile update successful');
} catch (profileError) {
  console.error('[syncMarketCheckInventory] Profile update failed:', {
    error: profileError instanceof Error ? profileError.message : String(profileError),
    stack: profileError instanceof Error ? profileError.stack : undefined,
    name: profileError instanceof Error ? profileError.name : undefined,
    userId: user.id,
    dealerId,
    zip: zip ?? null,
  });
  // Don't throw - allow sync to complete
}
```

### 2. Enhanced Logging in Profile Update Function

**File**: `apps/dealer-dashboard/src/lib/supabase/profile.ts`

**Changes**:
- Logs before Supabase upsert (payload details)
- Logs after Supabase upsert (result, error details)
- Captures full error object: message, code, details, hint, status

**Code Added**:
```typescript
console.log("[profiles] Attempting to update profile:", {
  userId: payload.id,
  fields: Object.keys(payload).filter(key => key !== 'id' && key !== 'updated_at'),
  payload: { ...payload },
});

const { data, error } = await supabase.from("profiles").upsert(payload, {
  onConflict: "id",
});

console.log("[profiles] Profile update result:", {
  success: !error,
  error: error ? {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  } : null,
  data: dataType,
});

if (error) {
  console.error("[profiles] failed to update profile", {
    error: {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: (error as any).status,
    },
    payload: { id: payload.id, fields: Object.keys(payload) },
  });
}
```

## How to Capture the Error

### Step 1: Reproduce the Error

1. Ensure server is running: `pnpm --filter dealer-dashboard dev`
2. Navigate to `http://localhost:3000/app/setup`
3. Enter dealer ID: `10015450`
4. Wait for rooftop to auto-detect
5. Click "Sync MarketCheck Inventory"
6. Wait for error banner to appear

### Step 2: Capture Server Logs

**In the terminal running the dev server**, look for these log entries:

1. **Profile Update Attempt**:
   ```
   [syncMarketCheckInventory] Updating dealer profile: {...}
   [profiles] Attempting to update profile: {...}
   ```

2. **Profile Update Result**:
   ```
   [profiles] Profile update result: {
     success: false,
     error: {
       message: '...',
       code: '...',
       details: '...',
       hint: '...'
     }
   }
   ```

3. **Profile Update Failure**:
   ```
   [profiles] failed to update profile: {
     error: {...},
     payload: {...}
   }
   
   [syncMarketCheckInventory] Profile update failed: {
     error: '...',
     stack: '...',
     userId: '...',
     dealerId: '10015450',
     zip: '77375'
   }
   ```

**Copy the complete log output** including all error details.

### Step 3: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "sync" or look for server action calls
4. Find the failed request
5. Check:
   - **Status Code**: (e.g., 500, 401, 403)
   - **Response Body**: JSON error message
   - **Request Headers**: Authorization, cookies

**Copy the network response details**.

### Step 4: Verify Profile Exists

**In Supabase Dashboard**:
1. Go to SQL Editor
2. Run: `SELECT * FROM profiles WHERE id = '<user_id>';`
3. Check if profile row exists
4. If it exists, check current values

**Or check via code**:
- Look for `[profiles]` log entries that show the userId
- Verify that userId matches the authenticated user

## Expected Error Scenarios

### Scenario 1: RLS Policy Blocking Update
**Error Code**: `42501` or `PGRST301`
**Error Message**: "new row violates row-level security policy"
**Fix**: Check RLS policies allow UPDATE for authenticated users

### Scenario 2: Missing Profile Row
**Error Code**: `23503` (foreign key violation) or RLS blocking INSERT
**Error Message**: "insert or update on table violates foreign key constraint" or RLS error
**Fix**: Ensure profile row exists (created by trigger on user signup)

### Scenario 3: Authentication Context Missing
**Error Code**: `PGRST301` or `401`
**Error Message**: "JWT expired" or "not authenticated"
**Fix**: Check server-side Supabase client has proper auth context

### Scenario 4: Column Doesn't Exist
**Error Code**: `42703`
**Error Message**: "column does not exist"
**Fix**: Verify migration `20250220_alter_profiles_marketcheck.sql` was run

## Root Cause Hypotheses

### Hypothesis 1: RLS Policy Issue
**Likelihood**: High
**Reason**: `upsert` operation might not work correctly with RLS policies
**Test**: Try separate INSERT/UPDATE logic instead of upsert

### Hypothesis 2: Missing Profile Row
**Likelihood**: Medium
**Reason**: If user profile wasn't created by trigger, INSERT will fail
**Test**: Check if profile exists before upsert

### Hypothesis 3: Authentication Context
**Likelihood**: Medium
**Reason**: Server action might not have proper auth cookies
**Test**: Verify `createClient()` from server.ts has access to cookies

### Hypothesis 4: Column Migration Not Applied
**Likelihood**: Low
**Reason**: `marketcheck_dealer_id` and `marketcheck_zip` columns might not exist
**Test**: Verify columns exist in Supabase

## Next Steps

1. **Run sync and capture logs** (see "How to Capture the Error" above)
2. **Document exact error** in `SYNC_TEST_RESULTS.md`
3. **Check Supabase** for profile row existence
4. **Verify RLS policies** are correctly applied
5. **Fix based on error code** (see "Expected Error Scenarios")

## Files Modified

- `apps/dealer-dashboard/src/app/app/setup/actions.ts` - Added try/catch and logging
- `apps/dealer-dashboard/src/lib/supabase/profile.ts` - Added detailed logging
- `docs/marketcheck/SYNC_TEST_RESULTS.md` - Added profile update failure section
- `docs/marketcheck/PROFILE_UPDATE_ERROR_DIAGNOSIS.md` - This file

## Summary

Enhanced logging has been added to capture the exact error when profile update fails. The error will now be logged with:
- Full error message
- Error code (PostgreSQL/Supabase error code)
- Error details and hint
- User ID and payload information

**Action Required**: Run the sync, capture the server logs, and update `SYNC_TEST_RESULTS.md` with the actual error details.


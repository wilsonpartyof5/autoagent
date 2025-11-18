# Zero Vehicles Debug Guide - Dealer 10015450

## Quick Summary

**Issue**: Dashboard sync returns "Imported 0 vehicles" for dealer 10015450, even though earlier API calls showed 3 listings.

**Status**: Enhanced logging added, ready for testing

## Immediate Actions Required

### 1. Test MarketCheck API Directly

```bash
cd /Users/mac/AutoAgent
node scripts/testDealerSync.js
```

**Capture the output** - it will show:
- Test 1: Dealer ID only (no ZIP)
- Test 2: Dealer ID + ZIP 77375
- Comparison summary

### 2. Run Dashboard Sync

1. Ensure dev server is running:
   ```bash
   pnpm --filter dealer-dashboard dev
   ```

2. Navigate to `http://localhost:3000/app/setup`
3. Enter Dealer ID: `10015450`
4. Wait for rooftop auto-detection (ZIP should auto-populate: `77375`)
5. Click "Sync MarketCheck Inventory"
6. **Capture all server logs** from the terminal

### 3. Query Supabase

Run in Supabase SQL Editor:

```sql
SELECT 
  vin, year, make, model, created_at
FROM inventory_vehicles
WHERE dealer_id = '10015450'
ORDER BY created_at DESC
LIMIT 10;
```

**Copy the results** (even if empty)

## Log Patterns to Look For

### MarketCheck API Response
```
[syncMarketCheckInventory] MarketCheck response: {
  dealerId: '10015450',
  zip: '77375',
  numFound: <number>,        ← Total found by MarketCheck
  listingsLength: <number>,  ← Actual listings returned
  firstVin: <string or null>
}
```

**Key Question**: Does `listingsLength` match `numFound`?

### Normalization Step
```
[syncMarketCheckInventory] Starting normalization and mapping: {
  enrichedListingsCount: <number>,
  originalListingsCount: <number>
}

[syncMarketCheckInventory] First normalized vehicle sample: {
  vin: '...',
  year: <number>,
  make: '...',
  model: '...',
  dealerName: '...',
  hasDealer: true/false
}
```

**Key Question**: Are vehicles being normalized successfully?

### Validation Step
```
[syncMarketCheckInventory] Normalization and mapping complete: {
  recordsCreated: <number>,        ← Should match listingsLength
  normalizationErrors: <number>,   ← Should be 0
  validationErrors: <number>       ← Should be 0
}
```

**Key Question**: Are there any errors during normalization/validation?

### Insert Step
```
[syncMarketCheckInventory] Supabase insert result: {
  recordsAttempted: <number>,
  insertSuccess: true/false,
  insertedCount: <number>,         ← Should match recordsCreated
  insertedVins: [...]
}
```

**Key Question**: Did Supabase insert succeed?

## Diagnostic Decision Tree

```
MarketCheck API Test Results
│
├─ Test 1 (no ZIP) returns 0 AND Test 2 (with ZIP) returns 0
│  └─→ MarketCheck has no active inventory for this dealer
│      └─→ Try different dealer ID or check MarketCheck dashboard
│
├─ Test 1 returns listings BUT Test 2 returns 0
│  └─→ ZIP parameter is filtering out all results
│      └─→ Try sync without ZIP or increase radius
│
└─ Both tests return listings
   └─→ Issue is in normalization/insert logic
       │
       ├─ listingsLength > 0 BUT recordsCreated = 0
       │  └─→ Normalization/validation is failing
       │      └─→ Check error logs for validation failures
       │
       ├─ recordsCreated > 0 BUT insertedCount = 0
       │  └─→ Supabase insert is failing
       │      └─→ Check insert error logs
       │
       └─ insertedCount > 0 BUT Supabase query returns 0
          └─→ RLS policy blocking reads OR wrong user_id
              └─→ Check RLS policies and user_id filter
```

## Common Root Causes

### 1. ZIP Parameter Too Restrictive
- **Symptom**: `num_found > 0` but `listings.length = 0`
- **Fix**: Clear ZIP field or increase radius

### 2. VehicleSchema Validation Fails
- **Symptom**: `validationErrors > 0` in logs
- **Common causes**: Invalid URLs, missing dealer.name
- **Fix**: Check first normalized vehicle sample

### 3. MarketCheck Inventory Changed
- **Symptom**: Test script returns 0 listings
- **Fix**: Verify dealer ID or try different dealer

### 4. Supabase Insert Fails
- **Symptom**: `insertSuccess: false` in logs
- **Fix**: Check insert error details (code, message, hint)

## Files to Check

1. **Server Logs**: Terminal running `pnpm --filter dealer-dashboard dev`
2. **Test Script Output**: `node scripts/testDealerSync.js`
3. **Supabase Query Results**: SQL Editor output
4. **Browser Network Tab**: Check for failed requests

## Documentation to Update

After capturing results, update:
- `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` - Add "Sync attempt - <date/time>" section with:
  - Test script output
  - Server log snippets
  - SQL query results
  - Root cause identified

## Next Steps After Investigation

1. ✅ Enhanced logging added
2. ⏳ Run test script and capture output
3. ⏳ Run dashboard sync and capture logs
4. ⏳ Query Supabase and capture results
5. ⏳ Document findings in dealer-sync-ask-jorge-lopez.md
6. ⏳ Fix root cause based on findings
7. ⏳ Re-test and verify vehicles import successfully


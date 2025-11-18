# Sync Troubleshooting - Rock Hill GMC

## Issue: Sync returns 0 vehicles but API test works

**STATUS**: ✅ **ROOT CAUSES IDENTIFIED AND FIXED**

See `docs/marketcheck/SYNC_ZERO_VEHICLES_FIX.md` for complete fix documentation.

## Root Causes

### 1. ✅ Validation Error (FIXED)
- **Issue**: All listings failing Zod validation due to invalid dealer website URL
- **Error**: `ZodError: "path": ["dealer", "website"], "message": "Invalid url"`
- **Fix**: Updated normalization to validate and normalize website URLs
- **File**: `packages/shared/src/marketcheck.ts`

### 2. ❌ Database Schema Missing (REQUIRES ACTION)
- **Issue**: Migrations haven't been run
- **Errors**: Tables/columns don't exist in Supabase
- **Fix**: Run `scripts/run-all-migrations.sql` in Supabase SQL Editor

### Symptoms
- Dashboard shows "Imported 0 vehicles"
- API test script returns 10 listings correctly
- Server logs show "No records to insert (listings array was empty)"

### Diagnosis

**API Test Results** (✅ Working):
```
✅ Listings found!
   First VIN: 1GT4UXEY6TF159491
   First Make: GMC
   First Model: Sierra 2500HD
   listings.length: 10
   num_found: 232
```

**Expected Sync Logs** (Should see these):
```
[syncMarketCheckInventory] Using source endpoint for dealer: { dealerId: '11042155', source: 'myrockhillgmc.com' }
[syncMarketCheckInventory] Fetching from MarketCheck: { url: '...', ... }
[syncMarketCheckInventory] Response status: { status: 200, ... }
[syncMarketCheckInventory] MarketCheck response: { numFound: 232, listingsLength: 10, ... }
```

### Troubleshooting Steps

#### 1. Check Server Logs

**Option A: Check log file**
```bash
tail -100 /tmp/dealer-dashboard-sync.log | grep -A 10 syncMarketCheckInventory
```

**Option B: Monitor in real-time**
```bash
tail -f /tmp/dealer-dashboard-sync.log | grep syncMarketCheckInventory
```

**Option C: Check server terminal**
- Look at the terminal where `npm run dev` is running
- Watch for `[syncMarketCheckInventory]` log entries when you click sync

#### 2. Verify Code is Deployed

```bash
# Check if source endpoint code exists
grep -n "11042155.*myrockhillgmc" apps/dealer-dashboard/src/app/app/setup/actions.ts
# Should show line 131: '11042155': 'myrockhillgmc.com',
```

#### 3. Clear Next.js Cache

```bash
cd apps/dealer-dashboard
rm -rf .next
npm run dev
```

#### 4. Verify Environment Variables

```bash
# Check if API key is set
grep MARKETCHECK_API_KEY apps/dealer-dashboard/.env.local
```

#### 5. Test API Directly

```bash
# Run diagnostic script
node scripts/diagnoseSyncIssue.js
# Should show 10 listings
```

### Common Issues

#### Issue: Server not using latest code
**Solution**: Clear `.next` cache and restart
```bash
cd apps/dealer-dashboard
rm -rf .next
pkill -f "next dev"
npm run dev
```

#### Issue: Environment variables not loaded
**Solution**: Verify `.env.local` exists and contains `MARKETCHECK_API_KEY`

#### Issue: Logs not appearing
**Solution**: Check server terminal directly (not log file)

### Expected Behavior

When sync works correctly, you should see:
1. ✅ "Using source endpoint for dealer" log
2. ✅ "Fetching from MarketCheck" log with correct URL
3. ✅ "MarketCheck response" log showing `listingsLength: 10`
4. ✅ "Supabase insert result" log showing `insertedCount: 10`
5. ✅ Dashboard shows "Imported 10 vehicles"

### Next Steps

1. **Clear Next.js cache and restart server**:
   ```bash
   cd apps/dealer-dashboard
   rm -rf .next
   pkill -f "next dev"
   npm run dev
   ```

2. **Trigger sync and watch logs**:
   - Go to `http://localhost:3000/app/setup`
   - Click "Sync MarketCheck Inventory"
   - Watch server terminal for logs

3. **If still 0 vehicles**, check:
   - Server terminal output (not log file)
   - Browser console for errors
   - Network tab for API calls

4. **Capture full logs**:
   ```bash
   # In one terminal, monitor logs
   tail -f /tmp/dealer-dashboard-sync.log
   
   # In browser, trigger sync
   # Then check what logs appeared
   ```


# MarketCheck Sync Execution Instructions

## Quick Sync Steps for Ask Jorge Lopez Dealer

### Prerequisites
- Dashboard running at `http://localhost:3000`
- User authenticated (logged into dashboard)
- MarketCheck API key configured

### Execution Steps

1. **Navigate to Setup Page**
   ```
   http://localhost:3000/app/setup
   ```

2. **Enter Dealer Information**
   - Dealer ID: `10015450`
   - ZIP Code: `77375` (optional)

3. **Click "Sync Inventory"**
   - Wait for success message
   - Should see: "Inventory synced from MarketCheck. Imported 3 vehicles."

4. **Verify Inventory**
   ```
   http://localhost:3000/app/inventory
   ```
   - Should see 3 vehicles displayed
   - All should be 2026 Ford F-250 Super Duty Platinum

5. **Capture Proof**
   - Screenshot: Save screenshot of `/app/inventory` page showing all 3 vehicles
   - Console Log: Check server console for `inventory_sync` event log

### Expected Console Log

Look for this JSON log line in the server console:
```json
{
  "event": "inventory_sync",
  "provider": "marketcheck",
  "dealerId": "10015450",
  "records": 3,
  "enrichmentEnabled": false,
  "enrichedCount": 0,
  "skippedCount": 3,
  "lastSyncedAt": "2025-11-07T...",
  "syncStatus": "success"
}
```

### Troubleshooting

**If sync fails:**
- Check server console for error messages
- Verify MarketCheck API key is set in environment
- Ensure user is authenticated (not redirected to `/auth`)
- Check Supabase connection is working

**If vehicles don't appear:**
- Check Supabase `inventory_vehicles` table
- Verify `user_id` matches authenticated user
- Check `dealer_id` = `10015450`
- Look for any error messages in browser console


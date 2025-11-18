# MarketCheck Enrichment Test Notes

## Test Setup
- **Date**: 2025-02-20
- **Environment**: Staging/Demo
- **Flag**: `MARKETCHECK_ENRICH_LISTINGS=1` (server-side only, no UI toggle)

## Test Execution

### 1. Environment Configuration
✅ Added `MARKETCHECK_ENRICH_LISTINGS=1` to `apps/dealer-dashboard/.env.local`
✅ Verified no UI controls exist for enrichment toggle (confirmed via grep search)

### 2. Expected Log Output
When running a sync with enrichment enabled, you should see:

```json
{
  "event": "inventory_sync",
  "provider": "marketcheck",
  "dealerId": "12345",
  "records": 10,
  "enrichmentEnabled": true,
  "enrichedCount": 8,
  "skippedCount": 2,
  "lastSyncedAt": "2025-02-20T...",
  "syncStatus": "success"
}
```

Additional enrichment-specific logs:
```json
{
  "event": "marketcheck_enrichment_failed",
  "listingId": "mc-12345",
  "error": "HTTP 404: Not Found"
}
```

### 3. UI Display Locations

#### Dashboard Inventory Cards (`/app/inventory`)
- **Seller Comments**: Displayed in muted background box, truncated to 2 lines with `line-clamp-2`, full text in tooltip
- **Option Packages**: Displayed as primary-colored badge pills with tooltips showing description
- **Enriched Photos**: Preferred over base photos (checks `enrichedPrimaryPhoto` → `enrichedPhotos[0]` → fallback chain)

#### ChatGPT Widget (`vehicle-results.html`)
- **Seller Comments**: Truncated to 80 chars in cards, 4 lines in drawer
- **Option Packages**: Up to 2 visible in cards, all shown in drawer with tooltips
- **Enriched Photos**: Preferred in both card and drawer views

### 4. Potential Issues to Watch For

#### Seller Comments
- ⚠️ **Very long comments**: Current truncation is 2 lines (CSS `line-clamp-2`). May need additional truncation for extremely long text.
- ⚠️ **Empty/null comments**: Code handles this with `sellerComments &&` check, but verify no layout shift occurs.
- ⚠️ **Special characters**: HTML escaping handled by React, but verify tooltips display correctly.

#### Option Packages
- ⚠️ **Empty option names**: Code falls back to `opt.name || opt.code || 'Option'`. Verify "Option" placeholder doesn't look broken.
- ⚠️ **Many options**: Cards show first 2 + "+N more" indicator. Drawer shows all. Verify layout doesn't break with 10+ options.
- ⚠️ **Missing descriptions**: Tooltip shows `opt.description || opt.name || ''`. Empty tooltip may be confusing.

#### Photos
- ⚠️ **Broken image URLs**: Code has fallback chain, but verify placeholder displays correctly.
- ⚠️ **Very large images**: No image optimization currently. May cause slow loading.

### 5. UI Polish Recommendations

#### Seller Comments
- [ ] Add max character limit (e.g., 500 chars) before truncation to prevent extremely long tooltips
- [ ] Consider "Read more" expandable for long comments in drawer
- [ ] Verify line-height and spacing for multi-line comments

#### Option Packages
- [ ] Add fallback text for empty option names: "Option Package" instead of just "Option"
- [ ] Consider limiting drawer display to 10-15 options max with "Show all" toggle
- [ ] Add visual indicator when tooltip has no description (e.g., lighter color)

#### Layout
- [ ] Verify card height consistency when seller comments/options are present vs absent
- [ ] Test on mobile: ensure option badges wrap correctly
- [ ] Check drawer scrolling behavior with many options

### 6. No Dealer-Facing Toggle
✅ Confirmed: No UI controls exist for enrichment toggle
- Searched entire `apps/dealer-dashboard/src` for "MARKETCHECK_ENRICH" - no matches
- Enrichment is purely server-side via environment variable
- Dealers cannot enable/disable enrichment themselves

## Test Results

### Screenshots Needed
1. **Dashboard Inventory Page** (`/app/inventory`):
   - Card with seller comments visible (truncated)
   - Card with option packages (badges visible)
   - Card with enriched photo

2. **ChatGPT Widget** (`vehicle-results.html`):
   - Card view with seller comments and options
   - Drawer view with full seller comments and all options

### Log Snippets to Capture
- Sync start log with `enrichmentEnabled: true`
- Enrichment stats log showing `enrichedCount` and `skippedCount`
- Any `marketcheck_enrichment_failed` errors
- Final sync completion log

## Next Steps
1. Run actual sync with staging dealer ID
2. Capture screenshots of enriched data display
3. Document any real-world data issues (long comments, empty fields, etc.)
4. Apply UI polish fixes based on observations


# MarketCheck Rooftop Auto-Detection

## Overview

The Drevvy dealer onboarding flow now automatically detects dealer rooftops/locations from MarketCheck when a dealer ID is entered. This streamlines the setup process by eliminating the need for manual ZIP code entry in most cases.

## How It Works

### 1. Dealer ID Entry

When a dealer enters their MarketCheck dealer ID in the setup form (`/app/setup`), the system automatically:

1. **Fetches Sample Inventory**: Queries MarketCheck API for up to 50 active listings from that dealer
2. **Extracts Unique Locations**: Identifies unique rooftops/locations based on ZIP + city + state combinations
3. **Returns Location Data**: Each rooftop includes:
   - Dealer name
   - Street address
   - City, state, ZIP
   - Latitude/longitude (if available)
   - Phone number (if available)
   - Website (if available)

### 2. UI Flow

The setup form handles three scenarios:

#### Multiple Rooftops Found
- Displays a radio button list showing each location
- Format: "Dealer Name – Address – City, State ZIP"
- User selects the correct location
- ZIP is automatically populated from selected rooftop

#### Single Rooftop Found
- Auto-selects the location
- Shows a confirmation card with location details
- ZIP is automatically populated
- User can click "Use a different location" to enter ZIP manually

#### No Rooftops Found
- Falls back to manual ZIP input
- Shows helper text: "Unable to fetch dealer locations. You can enter a ZIP manually."
- User can proceed with manual ZIP entry

### 3. Profile Persistence

When the sync is executed:
- Selected rooftop ZIP is saved to `profiles.marketcheck_zip`
- Dealer ID is saved to `profiles.marketcheck_dealer_id`
- On subsequent visits, the saved ZIP is pre-populated

## Implementation Details

### Server Action: `fetchDealerRooftops`

**Location**: `apps/dealer-dashboard/src/app/app/setup/actions.ts`

**Function Signature**:
```typescript
export async function fetchDealerRooftops(dealerId: string): Promise<DealerRooftop[]>
```

**Returns**: Array of `DealerRooftop` objects:
```typescript
type DealerRooftop = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
};
```

**Error Handling**:
- Returns empty array `[]` if API call fails
- Returns empty array if no listings found
- Logs errors to console but doesn't throw (allows UI fallback)

**API Endpoint Used**:
```
GET /v2/search/car/active?api_key={KEY}&dealer_id={ID}&pageSize=50
```

**Location Extraction Logic**:
- Iterates through listings
- Extracts dealer info from `listing.dealer` or `listing.mc_dealership`
- Uses `ZIP + city + state` as unique key to deduplicate
- Parses latitude/longitude from strings if needed

### UI Component: `InventorySyncForm`

**Location**: `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx`

**Key Features**:
- Debounced API calls (500ms delay) to avoid excessive requests
- Loading state while fetching rooftops
- Radio button selection for multiple rooftops
- Confirmation card for single rooftop
- Fallback to manual ZIP input
- "Use a different location" option to override auto-selection

**State Management**:
- `rooftops`: Array of fetched rooftops
- `selectedRooftop`: Currently selected rooftop (or null)
- `isLoadingRooftops`: Loading state
- `showManualZip`: Whether to show manual ZIP input
- `rooftopError`: Error message if fetch fails

### Sync Action Integration

The `syncMarketCheckInventory` action already accepts an optional `zip` parameter:

```typescript
export async function syncMarketCheckInventory({
  dealerId: string;
  zip?: string;
  radiusMiles?: number;
  condition?: 'all' | 'new' | 'used';
})
```

When a rooftop is selected:
1. ZIP is automatically set in component state
2. ZIP is passed to `syncMarketCheckInventory`
3. ZIP is used in MarketCheck API query: `?zip={zip}`
4. ZIP is saved to profile: `marketcheckZip: zip ?? null`

## Testing

### Manual Testing Steps

1. **Navigate to Setup Page**:
   ```
   http://localhost:3000/app/setup
   ```

2. **Enter Dealer ID**:
   - Enter a valid MarketCheck dealer ID (e.g., `10015450`)
   - Wait for rooftops to load (should see loading spinner)

3. **Test Single Rooftop**:
   - If dealer has one location, verify auto-selection
   - Check that ZIP is populated automatically
   - Try "Use a different location" to override

4. **Test Multiple Rooftops**:
   - Use a dealer ID with multiple locations
   - Verify radio button list appears
   - Select different rooftops and verify ZIP updates
   - Verify sync uses correct ZIP

5. **Test Error Handling**:
   - Enter invalid dealer ID
   - Verify fallback to manual ZIP input
   - Verify error message appears

6. **Test Profile Persistence**:
   - Complete sync with selected rooftop
   - Refresh page
   - Verify ZIP is pre-populated from profile

### Test Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Valid dealer ID, 1 location | Auto-selects, shows confirmation card |
| Valid dealer ID, multiple locations | Shows radio list, requires selection |
| Valid dealer ID, no listings | Falls back to manual ZIP input |
| Invalid dealer ID | Falls back to manual ZIP input with error |
| API timeout/error | Falls back to manual ZIP input with error |
| User clicks "Use different location" | Shows manual ZIP input |
| Sync with selected rooftop | ZIP saved to profile |

## Benefits

1. **Improved UX**: Dealers don't need to manually look up their ZIP code
2. **Accuracy**: Reduces errors from manual entry
3. **Multi-location Support**: Handles dealers with multiple rooftops gracefully
4. **Graceful Degradation**: Falls back to manual entry if auto-detection fails
5. **Profile Persistence**: Selected location is remembered for future syncs

## Limitations

1. **Requires Active Inventory**: Rooftops are extracted from active listings, so dealers with no active inventory won't see locations
2. **API Dependency**: Relies on MarketCheck API availability
3. **Sample Size**: Only checks first 50 listings (may miss locations if dealer has many locations with sparse inventory)
4. **Location Deduplication**: Uses ZIP+city+state as key, so identical addresses in different formats may appear as separate locations

## Future Enhancements

1. **Direct Dealer Endpoint**: Use `/v2/dealer/{dealer_id}` endpoint if available to get all locations directly
2. **Location Name Display**: Show location names if available in MarketCheck data
3. **Map Preview**: Show locations on a map for visual selection
4. **Caching**: Cache rooftop data to reduce API calls
5. **Validation**: Validate selected ZIP against actual dealer locations before sync

## Related Documentation

- [MarketCheck Dealer Sync Test](./dealer-sync-ask-jorge-lopez.md)
- [MarketCheck API Endpoints](../api/marketcheck-endpoints.md)
- [Dealer Onboarding Flow](../design/onboarding/loveable-onboarding-spec.md)


# iOS App API Integration Summary

## Status: ✅ COMPLETE

The iOS app has been successfully wired to the live Inventory Search API. All Step 0/1 UI remains intact.

---

## Files Added

### Configuration
- **`Models/Config.swift`**
  - Contains API base URL and API key loading logic
  - Reads `INVENTORY_SEARCH_API_KEY` from `Info.plist`
  - Falls back to mock data if API key is missing

### API Models
- **`Models/API/InventorySearchRequest.swift`**
  - Request models for API calls
  - `MapBounds` converts `MKCoordinateRegion` to API bounds format
  - `InventoryFilters`, `Pagination`, `UserLocation` structures

- **`Models/API/InventorySearchResponse.swift`**
  - Response models matching API structure
  - `InventorySearchVehicle.toVehicle()` converts API vehicles to app `Vehicle` model
  - Handles optional fields with safe defaults

### Services
- **`Services/InventoryAPIService.swift`**
  - `searchInventory()` async function for API calls
  - Handles authentication with `x-api-key` header
  - Comprehensive error handling with `InventoryAPIError` enum

---

## Files Modified

### ViewModels
- **`ViewModels/MapViewModel.swift`**
  - Added `@Published var isLoading: Bool` for loading state
  - Added `@Published var lastError: String?` for error tracking
  - Added `fetchInventory(bounds:filters:)` with 350ms debouncing
  - Replaced mock data initialization with API fetch logic
  - Falls back to mock data if API key missing or on errors
  - `updateVisibleVehicles()` now triggers API calls when API key available

- **`ViewModels/ChatViewModel.swift`**
  - Added `mapViewModel` reference for triggering API fetches
  - Added `setMapViewModel()` method
  - Triggers API fetch when map tool message is added

### Views
- **`Core Views/MapToolView.swift`**
  - Added `.onAppear` to trigger initial API fetch when map tool appears

- **`ContentView.swift`**
  - Added `.onAppear` to connect `ChatViewModel` to `MapViewModel`

### Models
- **`Models/Vehicle.swift`**
  - Added `coordinate: CLLocationCoordinate2D` computed property
  - Added `makeAndModel: String` computed property

---

## API Integration Details

### API Endpoint
- **URL:** `https://autoagent-dealer-dashboard.vercel.app/api/inventory/search`
- **Method:** POST
- **Authentication:** `x-api-key` header with value from `Info.plist`

### Request Format
```json
{
  "bounds": {
    "north": 34.9855,
    "south": 34.9123,
    "east": -80.9234,
    "west": -81.0123
  },
  "filters": { /* optional */ },
  "pagination": {
    "page": 1,
    "limit": 8
  },
  "userLocation": { /* optional */ }
}
```

### Response Format
```json
{
  "success": true,
  "data": {
    "vehicles": [...],
    "pagination": {...}
  }
}
```

### Debouncing
- Map region changes trigger API calls with 350ms debounce
- Prevents API spam during pan/zoom gestures
- Previous fetch tasks are cancelled when new ones start

---

## Configuration Required

### Info.plist Setup

Add the following key to your `Info.plist`:

```xml
<key>INVENTORY_SEARCH_API_KEY</key>
<string>YOUR_API_KEY_HERE</string>
```

**Important:** 
- Do NOT commit the actual API key to version control
- The key should be added to `Info.plist` in Xcode or via build settings
- If the key is missing, the app will log a warning and use mock data

### Where to Add Info.plist Key

1. In Xcode, select your project target
2. Go to "Info" tab
3. Add new row: Key = `INVENTORY_SEARCH_API_KEY`, Value = `your-api-key`
4. OR add directly to `Info.plist` file if it exists in the project

---

## Behavior

### API Mode (when API key is present)
1. User sends chat query → Map tool appears
2. `MapToolView.onAppear` triggers API fetch for current map region
3. API returns vehicles → Pins and cards update
4. User pans/zooms map → Debounced API fetch with new bounds
5. Map updates dynamically with real inventory data

### Fallback Mode (when API key is missing)
1. App detects missing API key on startup
2. Logs warning: `⚠️ WARNING: INVENTORY_SEARCH_API_KEY not found in Info.plist`
3. Uses mock data (8 vehicles around Los Angeles)
4. All UI remains functional with mock data

### Error Handling
- Network errors → Falls back to mock data if no data loaded
- API errors → Logs error, falls back to existing data
- Invalid responses → Shows error in `lastError`, uses mock data if needed

---

## Testing Checklist

- [x] API key missing → App uses mock data (no crash)
- [x] API key present → App fetches from API
- [x] Map tool appears → Initial API fetch triggered
- [x] Map pan/zoom → Debounced API fetch triggered
- [x] API returns vehicles → Pins and cards update correctly
- [x] API error → Falls back gracefully
- [x] Step 0/1 UI intact → All existing functionality preserved

---

## TODOs / Future Enhancements

1. **Query Parsing:** Currently query filters are simple keyword matching. Future enhancement could parse user queries into structured `InventoryFilters` (e.g., "black cars under $30k" → `{color: "black", maxPrice: 30000}`)

2. **Distance Calculation:** API may return distance in response. Could enhance `Vehicle` model to use API-provided distance instead of calculating locally.

3. **Image Loading:** API returns `thumbnailUrl` and `primaryPhotoUrl`. Could add image display to vehicle cards.

4. **Pagination:** API supports pagination. Could add "Load More" functionality for expanded map view.

5. **Error UI:** Currently errors are logged. Could add user-visible error messages in UI.

---

## Notes

- All code changes are iOS-only (no backend changes)
- Uses async/await with URLSession for networking
- API key is never logged (only presence is checked)
- Mock data fallback ensures app works even without API key
- Debouncing prevents excessive API calls during map interactions


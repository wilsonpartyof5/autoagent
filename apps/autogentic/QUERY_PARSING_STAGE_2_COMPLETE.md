# Stage 2 — iOS Integration Complete
## OpenAI Query Parsing API Integration

**Date**: 2025-01-27  
**Status**: ✅ Complete — Ready for Stage 3 approval

---

## Files Changed

### 1. Configuration
**`Autogentic/Models/Config.swift`** (MODIFIED)
- Added `queryParseBaseURL` constant
- Reuses existing `inventoryApiKey` for authentication (same key as inventory search)

### 2. New API Models
**`Autogentic/Models/API/QueryParseRequest.swift`** (NEW)
- Request model for query parsing endpoint
- Contains single `query: String` field

**`Autogentic/Models/API/QueryParseResponse.swift`** (NEW)
- Response model matching API contract
- Includes `ParsedFilters`, `APIFilters`, and `QueryParseError`
- Extension method `toInventoryFilters()` converts API filters to `InventorySearchRequest.InventoryFilters`

### 3. New Service
**`Autogentic/Services/QueryParseService.swift`** (NEW)
- Async/await service for calling `/api/query/parse`
- Handles authentication with `x-api-key` header
- Comprehensive error handling with `QueryParseError` enum
- Returns `APIFilters` ready for inventory search

### 4. Updated ViewModels
**`Autogentic/ViewModels/ChatViewModel.swift`** (MODIFIED)
- Updated `send(text:)` method to call query parsing
- Added `fetchWithQueryParsing(query:)` private method
- Integrates parse result into inventory fetch flow
- Fallback to keyword filtering if parse fails

**`Autogentic/ViewModels/MapViewModel.swift`** (NO CHANGES)
- Already accepts `filters` parameter in `fetchInventory(bounds:filters:)`
- Correctly forwards filters to `InventoryAPIService`
- No changes needed ✅

---

## New Flow Summary

### User Chat Flow

1. **User sends message** → `ChatViewModel.send(text:)`
2. **Append user message** to chat
3. **Append assistant acknowledgment**
4. **Append map tool message** (unchanged Step 0/1 UI)
5. **Parse query** (async):
   - If API key available: Call `QueryParseService.parseQuery()`
   - On success: Extract `apiCompatibleFilters`
   - On failure: Log error (don't block UI)
6. **Fetch inventory**:
   - If parse succeeded: `MapViewModel.fetchInventory(bounds:filters:parsedFilters)`
   - If parse failed: `MapViewModel.applyQuery(query)` + `fetchInventory(bounds:filters:nil)`
7. **Append assistant summary** (unchanged)

### Error Handling

**Parse failures are non-blocking:**
- Errors are logged to console
- App falls back to existing keyword filtering (`applyQuery`)
- Chat UI continues normally
- Map tool message still appears
- User experience remains smooth

**Error scenarios handled:**
- Missing API key → Skip parsing, use keyword filtering
- Network error → Log + fallback
- Parse API error → Log + fallback
- Invalid response → Log + fallback

---

## Flow Diagram

```
User Input
    ↓
ChatViewModel.send(text:)
    ↓
Append Messages (user, assistant, map tool)
    ↓
fetchWithQueryParsing(query:)
    ↓
┌─────────────────────────────────────┐
│ Try QueryParseService.parseQuery()  │
└─────────────────────────────────────┘
    ↓
    ├─ Success → Extract apiCompatibleFilters
    │              ↓
    │          MapViewModel.fetchInventory(bounds:filters:parsedFilters)
    │
    └─ Failure → Log error
                   ↓
               MapViewModel.applyQuery(query)
                   ↓
               MapViewModel.fetchInventory(bounds:filters:nil)
```

---

## Configuration Requirements

### Existing Configuration (No Changes Needed)
- `INVENTORY_SEARCH_API_KEY` in `Info.plist` - Used for both endpoints

### New Configuration (Added)
- `queryParseBaseURL` in `Config.swift` - Hardcoded to:
  ```
  https://autoagent-dealer-dashboard.vercel.app/api/query/parse
  ```

**Note**: Same API key is used for both `/api/query/parse` and `/api/inventory/search` endpoints.

---

## Code Examples

### Query Parsing Call
```swift
// In ChatViewModel.fetchWithQueryParsing()
do {
  let parsedFilters = try await QueryParseService.parseQuery(query)
  filters = parsedFilters.toInventoryFilters()
  print("✅ Query parsed successfully. Filters: \(parsedFilters)")
} catch {
  print("⚠️ Query parse failed: \(error.localizedDescription). Falling back to keyword filtering.")
  mapVM.applyQuery(query)
}
```

### Inventory Fetch with Filters
```swift
// In ChatViewModel.fetchWithQueryParsing()
mapVM.fetchInventory(bounds: region, filters: filters)
```

### Fallback Behavior
```swift
// If parse fails:
mapVM.applyQuery(query)  // Apply keyword filtering
mapVM.fetchInventory(bounds: region, filters: nil)  // Fetch without filters
```

---

## Testing Scenarios

### Scenario 1: Successful Parse
**Input**: "Show me red SUVs under $40,000"

**Flow**:
1. Parse succeeds → `{ maxPrice: 40000, bodyType: "SUV", exteriorColor: "red" }`
2. Extract API filters → `{ maxPrice: 40000 }` (bodyType/exteriorColor not supported yet)
3. Call inventory search with `maxPrice: 40000`
4. Map updates with filtered results

### Scenario 2: Parse Failure (Network Error)
**Input**: "Find trucks under $50k"

**Flow**:
1. Parse fails (network error)
2. Error logged to console
3. Fallback to `applyQuery("Find trucks under $50k")`
4. Call inventory search without filters
5. Keyword filtering applied locally to results

### Scenario 3: No API Key
**Input**: "Show me new Toyota Camry"

**Flow**:
1. `Config.hasApiKey == false`
2. Skip parsing entirely
3. Use `applyQuery()` keyword filtering
4. Use mock data or API (if available)

### Scenario 4: Parse Returns Empty Filters
**Input**: "Hello, how are you?"

**Flow**:
1. Parse succeeds but extracts no filters
2. `filters = nil`
3. Call inventory search with `filters: nil`
4. Returns all vehicles in bounds (no filtering)

---

## Constraints Maintained

✅ **No backend changes** - All changes are iOS-only  
✅ **Step 0/1 layout intact** - Map tool message, chat UI unchanged  
✅ **Async/await used** - Modern Swift concurrency  
✅ **Error handling** - Non-blocking, graceful fallbacks  
✅ **No API key logging** - Keys not printed to console (only warnings)

---

## Integration Points

### MapViewModel Integration
- ✅ `fetchInventory(bounds:filters:)` already accepts optional filters
- ✅ Filters correctly forwarded to `InventoryAPIService.searchInventory()`
- ✅ No changes needed to MapViewModel

### InventoryAPIService Integration
- ✅ Already accepts and encodes filters in request
- ✅ No changes needed to InventoryAPIService

### ChatViewModel Integration
- ✅ New `fetchWithQueryParsing()` method handles async parsing
- ✅ Existing `send(text:)` method updated to call parsing
- ✅ Map tool message still appears as before
- ✅ Error handling preserves user experience

---

## Next Steps for Stage 3

1. ✅ Add loading state in chat ("Searching…")
2. ✅ Show "No results" hint if empty
3. ✅ Enhance fallback behavior
4. ✅ Add basic logging/metrics

**Ready for Stage 3 approval?** ✅


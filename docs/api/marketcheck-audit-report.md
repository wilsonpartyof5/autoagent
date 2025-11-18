# MarketCheck API Documentation Audit Report

**Date**: Generated from codebase analysis  
**Official Docs**: https://docs.marketcheck.com/docs/api/cars/  
**Current Doc**: `docs/api/marketcheck-endpoints.md`

---

## Executive Summary

This audit compares our MarketCheck API documentation against:
1. Actual usage in the AutoAgent codebase
2. Official MarketCheck API documentation patterns
3. Required metafields for inventory integration

**Critical Findings**:
- ✅ Only `/v2/search/car/active` is actually used in codebase
- ⚠️ 4 endpoints documented but not implemented (`/listing/{id}`, `/listing/{id}/media`, `/listing/{id}/extra`, `/dealer/car/{id}`)
- ⚠️ Parameter documentation has discrepancies (required vs optional)
- ⚠️ Response structure needs validation against actual API responses

---

## 1. Endpoint Coverage Analysis

### Endpoints Documented vs. Actually Used

| Endpoint | Documented | Used in Codebase | Status |
|----------|------------|------------------|--------|
| `/v2/search/car/active` | ✅ Yes | ✅ Yes (`apps/dealer-dashboard/src/app/app/setup/actions.ts`, `apps/mcp-server/src/services/marketcheck.ts`) | **VERIFIED** |
| `/v2/listing/car/{id}` | ✅ Yes | ❌ No | **NOT USED** |
| `/v2/listing/car/{id}/media` | ✅ Yes | ❌ No | **NOT USED** |
| `/v2/listing/car/{id}/extra` | ✅ Yes | ❌ No | **NOT USED** |
| `/v2/dealer/car/{id}` | ✅ Yes | ❌ No | **NOT USED** |

### Recommendation
- **Action Required**: Either remove unused endpoints from documentation OR implement them if needed for inventory metafields
- **Question**: Do we need the listing/dealer endpoints for full inventory data, or does `/v2/search/car/active` provide all required fields?

---

## 2. `/v2/search/car/active` - Detailed Audit

### 2.1 Request Parameters

#### Current Documentation Says:
- **Required**: `api_key`, `dealer_id`
- **Optional**: `location`, `zip`, `radius`, `car_type`, `make`, `model`, `price_range`, `page`, `pageSize`

#### Actual Codebase Usage:

**From `apps/dealer-dashboard/src/app/app/setup/actions.ts`**:
```typescript
const searchParams = new URLSearchParams({
  api_key: apiKey,
  dealer_id: dealerId,  // Required in our code
  page: '1',
  pageSize: '100',
});
// Optional: zip, radius, car_type
```

**From `apps/mcp-server/src/services/marketcheck.ts`**:
```typescript
// Required: api_key
// Optional: location, car_type, price_range, make, model, radius, page, pageSize
// NO dealer_id required for general search
```

#### Issues Found:

1. **`dealer_id` is NOT required** for general search; only required when filtering by dealer
   - **Current doc**: Lists `dealer_id` as required
   - **Reality**: Our MCP server uses search WITHOUT `dealer_id`
   - **Fix**: Make `dealer_id` optional, note it's required only for dealer-specific inventory sync

2. **`location` vs `zip` + `radius`**:
   - **Current doc**: Lists both as optional
   - **Reality**: Code uses `location` OR `zip`+`radius` (not both)
   - **Fix**: Clarify mutual exclusivity or precedence

3. **Missing Parameters** (need to verify against official docs):
   - `year` (min/max)
   - `seller_type` (dealer, private, fsbo)
   - `transmission`
   - `drivetrain`
   - `body_type`
   - `fuel_type`
   - `certified` (boolean)
   - `miles` (min/max range)
   - `sort` (sorting options)

#### Recommended Fixes:

```markdown
### Request Parameters

#### Required
- `api_key` (string): MarketCheck API key

#### Optional (Location)
- `location` (string): Location string for geographic search
  - Format: `"City, State"` or `"City, ST"`
  - Example: `"Seattle, WA"`
  - **Note**: Mutually exclusive with `zip`+`radius`; if both provided, `location` takes precedence
- `zip` (string): ZIP code for location-based search
  - Example: `"98101"`
  - **Note**: Use with `radius` for geographic filtering
- `radius` (number): Search radius in miles (default: 50)
  - Example: `50`, `100`
  - **Note**: Only effective when used with `zip` or `location`

#### Optional (Dealer Filter)
- `dealer_id` (string): Dealer identifier for filtering inventory
  - Example: `"12345"`
  - **Note**: Required for dealer-specific inventory sync; optional for general search

#### Optional (Vehicle Filters)
- `car_type` (string): Vehicle condition filter
  - Allowed values: `"new"`, `"used"`
  - **Note**: Omit for all conditions
- `make` (string): Vehicle make filter
  - Example: `"Toyota"`, `"Honda"`
- `model` (string): Vehicle model filter
  - Example: `"Camry"`, `"RAV4"`
- `year` (string): Model year filter (format: `"2020"` or `"2020-2023"`)
  - Example: `"2022"`, `"2020-2023"`
- `price_range` (string): Price range filter
  - Format: `"min-max"`
  - Example: `"0-30000"`, `"20000-50000"`
- `miles` (string): Mileage range filter (format: `"0-50000"`)
  - Example: `"0-30000"`, `"50000-100000"`
- `transmission` (string): Transmission type
  - Example: `"Automatic"`, `"Manual"`
- `drivetrain` (string): Drivetrain type
  - Example: `"FWD"`, `"RWD"`, `"AWD"`
- `body_type` (string): Body type
  - Example: `"Sedan"`, `"SUV"`, `"Truck"`
- `fuel_type` (string): Fuel type
  - Example: `"Gasoline"`, `"Hybrid"`, `"Electric"`
- `certified` (boolean): CPO certification filter
  - Example: `true`, `false`

#### Optional (Pagination & Sorting)
- `page` (number): Page number for pagination (default: 1)
  - Example: `1`, `2`, `3`
- `pageSize` (number): Results per page (default: 20, max: 100)
  - Example: `20`, `50`, `100`
- `sort` (string): Sort order
  - Allowed values: `"price"`, `"miles"`, `"year"`, `"dom"` (days on market)
  - Example: `"price"`, `"price:desc"`
```

### 2.2 Response Structure

#### Current Documentation Issues:

1. **Response Wrapper**: Document shows `listings` array directly, but codebase expects wrapper:
   ```typescript
   // From codebase:
   const payload = await response.json();
   listings = Array.isArray(payload.listings) ? payload.listings : [];
   ```
   - **Fix**: Document that response is `{ listings: [...], num_found: number, page: number, pageSize: number }`

2. **Field Names**: Some field names may differ:
   - `inventory_type` vs `car_type` (need to verify)
   - `dom` vs `days_on_market` (codebase uses both)
   - `miles` vs `mileage` (codebase handles both)

3. **Missing Fields** (from `MarketCheckVehicle` interface):
   - `heading` (string?) - Vehicle title/heading
   - `source` (string?) - Data source identifier

#### Response Structure Validation Needed:

**Fields we map (from `packages/shared/src/marketcheck.ts`)**:
- ✅ `id` → `listingId`
- ✅ `vin` → `vin`
- ✅ `stock_no` → `stockNumber`
- ✅ `price` → `price`
- ✅ `msrp` → `msrp`
- ✅ `dom` → `daysOnMarket`
- ✅ `miles` / `mileage` → `miles`
- ✅ `inventory_type` → `condition` (new/used/cpo mapping)
- ✅ `certified` → `certified`
- ✅ `exterior_color` → `exteriorColor`
- ✅ `interior_color` → `interiorColor`
- ✅ `media.photo_links` → `photoUrls`
- ✅ `media.primary_photo_url` → `thumbnailUrl`, `imageUrl`
- ✅ `media.thumbnail.url` → `thumbnailUrl` (fallback)
- ✅ `media.video_url` → `videoUrl`
- ✅ `features` → `features`
- ✅ `price_history` → `priceChangeHistory`
- ✅ `market_data.market_average_price` → `marketAveragePrice`
- ✅ `dealer.*` → `dealer.*`
- ✅ `build.*` → vehicle specs

**All documented fields are used in normalization** ✅

### 2.3 Pagination Behavior

#### Current Documentation:
- Default page size: 20
- Maximum page size: 100

#### Codebase Usage:
- MCP server: `pageSize: 20` (hardcoded)
- Dealer dashboard: `pageSize: 100` (hardcoded)

#### Validation:
- ✅ Default 20 matches codebase
- ✅ Max 100 matches codebase
- ⚠️ **Need to verify**: Is 100 the actual API max, or can we request more?

---

## 3. `/v2/listing/car/{id}` - Audit

### Status: NOT USED IN CODEBASE

### Issues:
1. **Endpoint Path**: Documented as `/v2/listing/car/{id}`, but need to verify:
   - Is it `/v2/listing/car/{id}` or `/listing/car/{id}`?
   - Official docs may use different path structure

2. **Response Structure**: Currently inferred from search response
   - **Need**: Actual API response sample or official documentation

3. **Use Case**: 
   - **Question**: Do we need this for inventory metafields?
   - If search provides all fields, this may be unnecessary
   - If we need seller comments, extended history, or detailed specs, we need this endpoint

### Recommendation:
- **If not needed**: Remove from documentation or mark as "Future Use"
- **If needed**: Implement in codebase and validate response structure

---

## 4. `/v2/listing/car/{id}/media` - Audit

### Status: NOT USED IN CODEBASE

### Issues:
1. **Endpoint Path**: Need to verify exact path
   - Could be `/v2/listing/car/{id}/media` or `/listing/car/{id}/media`

2. **Response Structure**: Completely inferred
   - No actual API usage to validate
   - Need official documentation or sample response

3. **Use Case**:
   - **Question**: Does search response include all photos, or do we need this endpoint?
   - Current codebase uses `media.photo_links` from search response
   - May need this if search only returns limited photos

### Recommendation:
- **If search provides all photos**: Remove or note as "For additional photos beyond search results"
- **If search limits photos**: Validate endpoint exists and document actual response

---

## 5. `/v2/listing/car/{id}/extra` - Audit

### Status: NOT USED IN CODEBASE

### Issues:
1. **Endpoint Path**: Need to verify exact path
2. **Response Structure**: Completely inferred
3. **Use Case**: Seller comments, extended features, warranty info

### Recommendation:
- **If needed for metafields**: Implement and validate
- **If not needed**: Remove or mark as "Future Use"

---

## 6. `/v2/dealer/car/{id}` - Audit

### Status: NOT USED IN CODEBASE

### Issues:
1. **Endpoint Path**: Documented as `/v2/dealer/car/{id}`
   - **Likely correct**: `/v2/dealer/{dealer_id}` (not `/dealer/car/{id}`)
   - Need to verify official path

2. **Response Structure**: Inferred
3. **Use Case**: Dealer metadata (hours, ratings, contact info)

### Recommendation:
- **If dealer block from search is sufficient**: Remove
- **If we need extended dealer info**: Verify endpoint path and implement

---

## 7. Critical Gaps & Discrepancies

### 7.1 Parameter Validation

| Issue | Severity | Impact |
|-------|----------|--------|
| `dealer_id` marked as required but isn't | **HIGH** | Could mislead developers; MCP server doesn't use it |
| Missing optional parameters (year, transmission, etc.) | **MEDIUM** | Limits search capabilities |
| `location` vs `zip`+`radius` mutual exclusivity not documented | **MEDIUM** | Could cause confusion |

### 7.2 Response Structure

| Issue | Severity | Impact |
|-------|----------|--------|
| Response wrapper structure unclear | **MEDIUM** | Could cause parsing errors |
| Field name variations not documented (`dom` vs `days_on_market`) | **LOW** | Codebase handles both, but should document |
| Missing `heading` field in documentation | **LOW** | Minor field, but used in normalization |

### 7.3 Endpoint Coverage

| Issue | Severity | Impact |
|-------|----------|--------|
| 4 of 5 endpoints not implemented | **HIGH** | Documentation doesn't match reality |
| Endpoint paths may be incorrect | **HIGH** | Could cause 404 errors if implemented |
| Response structures completely inferred | **HIGH** | No validation against actual API |

---

## 8. Recommended Actions

### Immediate (Before Using Documentation)

1. **Validate `/v2/search/car/active`**:
   - [ ] Test actual API response structure
   - [ ] Verify all parameter options against official docs
   - [ ] Confirm pagination max (100?)
   - [ ] Validate rate limits

2. **Clarify Endpoint Status**:
   - [ ] Mark unused endpoints as "Future Use" or "Not Implemented"
   - [ ] Verify endpoint paths against official docs
   - [ ] Remove endpoints if not needed for metafields

3. **Fix Parameter Documentation**:
   - [ ] Make `dealer_id` optional with usage notes
   - [ ] Document `location` vs `zip`+`radius` mutual exclusivity
   - [ ] Add missing optional parameters (year, transmission, etc.)

### Short-term (For Full Integration)

4. **Implement Missing Endpoints** (if needed):
   - [ ] `/v2/listing/car/{id}` - If seller comments needed
   - [ ] `/v2/listing/car/{id}/media` - If search limits photos
   - [ ] `/v2/listing/car/{id}/extra` - If extended features needed
   - [ ] `/v2/dealer/{dealer_id}` - If extended dealer info needed

5. **Validate Response Structures**:
   - [ ] Test each endpoint with actual API calls
   - [ ] Update response examples with real data
   - [ ] Document field variations (dom vs days_on_market)

### Long-term (Documentation Maintenance)

6. **Add Official Documentation Links**:
   - [ ] Link to official MarketCheck docs for each endpoint
   - [ ] Note any discrepancies between our doc and official

7. **Add Testing & Validation**:
   - [ ] Include sample requests/responses
   - [ ] Document error responses
   - [ ] Add rate limit testing results

---

## 9. Summary of Required Edits

### High Priority

1. **Fix `/v2/search/car/active` parameters**:
   - Make `dealer_id` optional
   - Document `location` vs `zip`+`radius` behavior
   - Add missing optional parameters

2. **Clarify endpoint status**:
   - Add section: "Endpoints Currently Used" vs "Endpoints for Future Use"
   - Mark unused endpoints appropriately

3. **Validate response structure**:
   - Test actual API response
   - Update examples with real structure

### Medium Priority

4. **Add missing parameters** to `/v2/search/car/active`
5. **Verify endpoint paths** for unused endpoints
6. **Document field name variations**

### Low Priority

7. Add official documentation links
8. Enhance examples with real data
9. Add error response documentation

---

## 10. Questions for Product/Engineering

1. **Do we need the listing/dealer endpoints for inventory metafields?**
   - If search provides all required data, we can remove unused endpoints
   - If we need seller comments, extended photos, or dealer hours, we need to implement them

2. **What's the priority for implementing unused endpoints?**
   - Should we implement them now, or mark as "Future Use"?

3. **Rate limits**: What are the actual MarketCheck API rate limits?
   - Needed for proper throttling and error handling

4. **Pagination max**: Is 100 the actual maximum pageSize, or can we request more?

---

## Appendix: Codebase References

### Files Using MarketCheck API:
- `apps/dealer-dashboard/src/app/app/setup/actions.ts` - Dealer inventory sync
- `apps/mcp-server/src/services/marketcheck.ts` - General vehicle search
- `packages/shared/src/marketcheck.ts` - Response normalization

### Key Interfaces:
- `MarketCheckVehicle` - Raw API response structure
- `Vehicle` - Normalized internal schema

### Actual API Calls:
- Only `/v2/search/car/active` is used
- Base URL: `https://marketcheck-prod.apigee.net`
- Authentication: `api_key` query parameter


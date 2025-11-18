# MarketCheck API Documentation Audit - Executive Summary

**Date**: Current  
**Audited File**: `docs/api/marketcheck-endpoints.md`  
**Full Report**: See `docs/api/marketcheck-audit-report.md`

---

## Critical Findings

### ✅ Endpoint Coverage
- **Only 1 of 5 endpoints is actually used**: `/v2/search/car/active`
- **4 endpoints documented but not implemented**: `/listing/{id}`, `/listing/{id}/media`, `/listing/{id}/extra`, `/dealer/car/{id}`

### ⚠️ Parameter Issues
1. **`dealer_id` incorrectly marked as REQUIRED** - It's optional (only needed for dealer-specific sync)
2. **Missing optional parameters**: `year`, `transmission`, `drivetrain`, `body_type`, `fuel_type`, `certified`, `miles`, `sort`
3. **`location` vs `zip`+`radius`** - Mutual exclusivity not documented

### ⚠️ Response Structure
- Response wrapper structure unclear (should be `{ listings: [], num_found: number, page: number, pageSize: number }`)
- Field name variations not documented (`dom` vs `days_on_market`, `miles` vs `mileage`)
- Missing `heading` field in documentation

---

## Required Edits to `marketcheck-endpoints.md`

### 1. Fix `/v2/search/car/active` Parameters (Lines 15-41)

**Change**:
```markdown
#### Required
- `api_key` (string): MarketCheck API key
- `dealer_id` (string): Dealer identifier for filtering inventory
```

**To**:
```markdown
#### Required
- `api_key` (string): MarketCheck API key

#### Optional (Dealer Filter)
- `dealer_id` (string): Dealer identifier for filtering inventory
  - Example: `"12345"`
  - **Note**: Required for dealer-specific inventory sync; optional for general search

#### Optional (Location - Mutually Exclusive)
- `location` (string): Location string for geographic search
  - Format: `"City, State"` or `"City, ST"`
  - Example: `"Seattle, WA"` or `"New York, NY"`
  - **Note**: If both `location` and `zip` are provided, `location` takes precedence
- `zip` (string): ZIP code for location-based search
  - Example: `"98101"`
  - **Note**: Use with `radius` for geographic filtering
- `radius` (number): Search radius in miles (default: 50, only effective with `zip` or `location`)
  - Example: `50`, `100`
```

**Add Missing Optional Parameters**:
```markdown
#### Optional (Vehicle Filters)
- `year` (string): Model year filter
  - Format: `"2020"` or `"2020-2023"` for range
  - Example: `"2022"`, `"2020-2023"`
- `miles` (string): Mileage range filter
  - Format: `"min-max"`
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

#### Optional (Sorting)
- `sort` (string): Sort order
  - Allowed values: `"price"`, `"miles"`, `"year"`, `"dom"` (days on market)
  - Example: `"price"`, `"price:desc"`
```

### 2. Fix Response Structure (Lines 45-118)

**Change** top-level response to include wrapper:
```markdown
### Response Structure

```json
{
  "listings": [
    {
      "id": "mc-12345",
      ...
    }
  ],
  "num_found": 150,
  "page": 1,
  "pageSize": 20
}
```
```

**Add to Key Response Fields table**:
```markdown
| `heading` | string? | Vehicle title/heading |
```

**Add Field Variations Note**:
```markdown
### Field Name Variations

- `dom` and `days_on_market` may both appear (use `dom` if available)
- `miles` and `mileage` may both appear (use `miles` if available)
- `drivetrain` and `drive_train` may both appear (prefer `drivetrain`)
```

### 3. Add Endpoint Status Section (After Line 7)

```markdown
## Endpoint Status

### Currently Implemented
- ✅ `/v2/search/car/active` - Used in `apps/dealer-dashboard` and `apps/mcp-server`

### Documented but Not Implemented
- ⚠️ `/v2/listing/car/{id}` - **Status**: Not used in codebase; endpoint path needs verification
- ⚠️ `/v2/listing/car/{id}/media` - **Status**: Not used in codebase; endpoint path needs verification
- ⚠️ `/v2/listing/car/{id}/extra` - **Status**: Not used in codebase; endpoint path needs verification
- ⚠️ `/v2/dealer/car/{id}` - **Status**: Not used in codebase; likely should be `/v2/dealer/{dealer_id}`

**Note**: These endpoints are documented for future use. Verify endpoint paths and response structures against official MarketCheck API documentation before implementation.

---
```

### 4. Update Sections 2-5 (Unused Endpoints)

**Add to each unused endpoint section** (after the title):

```markdown
**⚠️ Status**: This endpoint is documented but not currently used in the AutoAgent codebase. Verify endpoint path and response structure against official MarketCheck API documentation before implementation.

**Use Case**: [Describe when this endpoint would be needed]
```

---

## Validation Checklist

Before relying on this documentation:

- [ ] Test `/v2/search/car/active` with actual API call
- [ ] Verify response structure matches documented format
- [ ] Confirm pagination max (100?)
- [ ] Test all optional parameters
- [ ] Validate rate limits (if available in official docs)
- [ ] Verify unused endpoint paths against official docs
- [ ] Test response structures for unused endpoints (if implementing)

---

## Questions to Resolve

1. **Do we need the listing/dealer endpoints for inventory metafields?**
   - If `/v2/search/car/active` provides all required data, consider removing unused endpoints
   - If we need seller comments, extended photos, or dealer hours, implement them

2. **What are the actual MarketCheck API rate limits?**
   - Needed for proper throttling and error handling

3. **Is 100 the actual maximum pageSize?**
   - Codebase uses 100, but need to verify against official docs

---

## Next Steps

1. **Immediate**: Fix `/v2/search/car/active` parameter documentation (dealer_id, location behavior)
2. **Short-term**: Add missing optional parameters
3. **Validate**: Test actual API responses and update examples
4. **Decide**: Keep or remove unused endpoints based on requirements
5. **Implement**: Add unused endpoints to codebase if needed for metafields

---

## Files Referenced

- `docs/api/marketcheck-endpoints.md` - Current documentation (to be updated)
- `docs/api/marketcheck-audit-report.md` - Full detailed audit
- `apps/dealer-dashboard/src/app/app/setup/actions.ts` - Dealer inventory sync
- `apps/mcp-server/src/services/marketcheck.ts` - General vehicle search
- `packages/shared/src/marketcheck.ts` - Response normalization


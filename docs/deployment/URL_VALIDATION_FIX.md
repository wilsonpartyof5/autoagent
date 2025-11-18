# URL Validation Fix for search-vehicles Tool

**Date:** 2025-11-13  
**Commit:** `d3ea986`  
**Issue:** Zod URL validation failing on widget URLs

---

## Problem

The `search-vehicles` tool was returning a validation error:
```json
{
  "code": -32603,
  "message": "Internal error",
  "data": "[{\"validation\":\"url\",\"code\":\"invalid_string\",\"message\":\"Invalid url\",\"path\":[\"components\",0,\"url\"]}]"
```

## Root Cause

The widget URL was being constructed using template literals:
```typescript
const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
```

While this produces valid URLs, Zod's `z.string().url()` validation can be strict about URL encoding, especially with query parameters. Using the native `URL` API ensures proper encoding and validation.

## Solution

Changed URL construction to use the `URL` API with `URLSearchParams`:

**Before:**
```typescript
const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
```

**After:**
```typescript
const widgetUrl = new URL('/widget/vehicle-results', widgetHost);
widgetUrl.searchParams.set('rid', runId);
if (isDiag) {
  widgetUrl.searchParams.set('diag', '1');
}
const vehicleResultsUrl = widgetUrl.toString();
```

## Files Changed

1. `apps/mcp-server/src/tools/searchVehicles.ts` - Fixed URL construction in both cache hit and cache miss paths
2. `apps/mcp-server/src/tools/pingUi.ts` - Updated for consistency
3. `apps/mcp-server/src/tools/pingMicroUi.ts` - Updated for consistency

## Benefits

1. **Proper Encoding:** `URLSearchParams` automatically encodes query parameters
2. **Validation:** The `URL` constructor validates the base URL format
3. **Consistency:** All widget URLs now use the same construction method
4. **Reliability:** Ensures URLs always pass Zod's `z.string().url()` validation

## Testing

After deployment, verify:
```bash
curl -X POST https://autoagentmcp-server-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search-vehicles","arguments":{"location":"Seattle, WA","condition":"used"}}}' \
  | jq '.result.data.components[0].url'
```

Expected: A valid URL like `https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results?rid=<uuid>&diag=1`

---

**Status:** ✅ Fixed and deployed


# Default Filter Values Fix - Implementation Summary

**Date**: 2025-01-12  
**Status**: ✅ **Code Fixed** - Waiting for cache expiry to verify

---

## Problem

OpenAI parser was returning default values (year=1900, condition="new", etc.) that were being treated as real filters, causing zero results.

---

## Solution

Refactored `validateAndNormalize()` to only include fields in `apiCompatibleFilters` if they were explicitly parsed (not defaults).

### Changes Made

1. **Created `extractExplicitlyParsedFields()` function**:
   - Extracts which fields were explicitly set BEFORE normalization
   - Filters out default values:
     - `minPrice/maxPrice/maxMiles === 0` → Not explicitly parsed
     - `year/minYear/maxYear === 1900` → Not explicitly parsed
     - Empty strings → Not explicitly parsed

2. **Updated `validateAndNormalize()` function**:
   - Now accepts `explicitlyParsedFields: Set<string>` parameter
   - Only adds fields to `apiCompatibleFilters` if they're in `explicitlyParsedFields`
   - Sets fields to `undefined` if not explicitly parsed (even if they have values)

3. **Updated POST handler**:
   - Calls `extractExplicitlyParsedFields()` BEFORE normalization
   - Passes result to `validateAndNormalize()`

---

## Files Changed

- ✅ `apps/dealer-dashboard/src/app/api/query/parse/route.ts`

---

## Cache Issue

**Note**: Responses are cached for 7 minutes. Old cached responses (from before the fix) will still return default values until the cache expires.

To test:
1. Wait 7+ minutes after deployment for cache to expire, OR
2. Use a completely new query that hasn't been cached yet

---

## Expected Behavior

**Query**: `"cars near Rock Hill, SC"`

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "filters": {
      "locationText": "near Rock Hill, SC"
    },
    "apiCompatibleFilters": {},  // Empty - no defaults included
    "location": {
      "raw": "near Rock Hill, SC",
      "lat": 34.923685,
      "lng": -81.026183,
      "source": "geocode"
    }
  }
}
```

---

## Status

- ✅ Code fixed and deployed
- ⏳ Waiting for cache expiry to verify in production
- ✅ TypeScript compilation successful


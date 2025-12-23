# Mapbox Geocoding Integration

**Date**: 2025-01-12  
**Status**: ✅ Implemented

---

## Overview

The `/api/query/parse` endpoint uses **Mapbox Geocoding API** to convert location mentions in user queries to lat/lng coordinates.

---

## Configuration

### Environment Variable

**Required for geocoding** (optional - gracefully degrades if not set):
```bash
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

### API Endpoint

```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json
```

**Query Parameters**:
- `access_token`: MAPBOX_ACCESS_TOKEN
- `limit`: 1 (returns only the best match)

**Response Format**:
```json
{
  "features": [
    {
      "center": [lng, lat],  // Note: [longitude, latitude] order
      ...
    }
  ]
}
```

---

## Implementation Details

### Location
- File: `apps/dealer-dashboard/src/app/api/query/parse/route.ts`
- Function: `geocodeLocation(locationText: string)`

### Behavior
1. Normalizes location text (removes "near" prefix, trims)
2. Checks 24-hour cache first
3. Calls Mapbox Geocoding API if not cached
4. Extracts `center` array (Mapbox returns `[lng, lat]`)
5. Returns `LocationData` with `{ raw, lat, lng, source: "geocode" }`
6. Caches result for 24 hours

### Error Handling
- Returns `null` if API key not set (doesn't fail request)
- Returns `null` if geocoding fails (doesn't fail request)
- Logs errors for debugging

---

## Caching

- **TTL**: 24 hours
- **Key**: Normalized location text (lowercase, trimmed)
- **Storage**: In-memory Map (per-serverless-instance)
- **Cleanup**: Probabilistic cleanup every ~10th request

---

## Rate Limits

Mapbox free tier includes:
- **100,000 requests/month**
- No per-second rate limit specified (check Mapbox docs)

With 24-hour caching, actual API calls will be much lower than parse requests.

---

## Testing

Example query:
```json
{
  "query": "cars near Rock Hill, SC"
}
```

Expected response:
```json
{
  "success": true,
  "data": {
    "location": {
      "raw": "Rock Hill, SC",
      "lat": 34.9249,
      "lng": -81.0251,
      "source": "geocode"
    },
    ...
  }
}
```


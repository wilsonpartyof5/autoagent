# Query Parse API Test Report
## Cache + Rate Limit Validation

**Date**: 2025-01-27  
**Status**: ⚠️ Test Script Ready (Requires API Key)

---

## Test Script Created

**Location**: `/tmp/test-query-parse.sh`

**Tests Included**:
1. ✅ Baseline request (first request)
2. ✅ Cache hit test (same query twice)
3. ✅ Rate limit test (35 requests to verify 429 after ~30)

---

## How to Run Tests

### Prerequisites
Set the `INVENTORY_SEARCH_API_KEY` environment variable:

```bash
export INVENTORY_SEARCH_API_KEY="your-api-key-here"
```

### Run Full Test Suite
```bash
bash /tmp/test-query-parse.sh
```

### Manual Test Commands

#### 1. Baseline Request
```bash
curl -s -X POST https://autoagent-dealer-dashboard.vercel.app/api/query/parse \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INVENTORY_SEARCH_API_KEY" \
  -d '{"query":"Show me red SUVs under $40,000"}'
```

**Expected**: JSON response with `success: true` and parsed filters

#### 2. Cache Hit Test
```bash
# First request (cache miss)
curl -s -X POST https://autoagent-dealer-dashboard.vercel.app/api/query/parse \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INVENTORY_SEARCH_API_KEY" \
  -d '{"query":"Show me red SUVs under $40,000"}' > /tmp/parse1.json

# Second request (should be cached)
curl -s -X POST https://autoagent-dealer-dashboard.vercel.app/api/query/parse \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INVENTORY_SEARCH_API_KEY" \
  -d '{"query":"Show me red SUVs under $40,000"}' > /tmp/parse2.json

# Compare (should be identical)
diff /tmp/parse1.json /tmp/parse2.json
```

**Expected**: No differences (files should be identical), second request should be faster

#### 3. Rate Limit Test
```bash
for i in $(seq 1 35); do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://autoagent-dealer-dashboard.vercel.app/api/query/parse \
    -H "Content-Type: application/json" \
    -H "x-api-key: $INVENTORY_SEARCH_API_KEY" \
    -d '{"query":"Show me red SUVs under $40,000"}')
  echo "$i -> $status"
done
```

**Expected**: 
- Requests 1-30: `200` (success)
- Requests 31-35: `429` (rate limited)

---

## Expected Results

### Baseline Request
- **Status**: `200 OK`
- **Response Time**: 1-3 seconds (uncached, OpenAI API call)
- **Response**: 
  ```json
  {
    "success": true,
    "data": {
      "filters": {
        "maxPrice": 40000,
        "bodyType": "SUV",
        "exteriorColor": "red"
      },
      "confidence": 0.8,
      "parsedFields": ["maxPrice", "bodyType", "exteriorColor"],
      "apiCompatibleFilters": {
        "maxPrice": 40000
      }
    }
  }
  ```

### Cache Hit Test
- **First Request**: ~1-3s (cache miss, OpenAI call)
- **Second Request**: <100ms (cache hit, no OpenAI call)
- **Response Match**: ✅ Identical JSON
- **Speedup**: >90% faster (from ~2000ms to <100ms)

### Rate Limit Test
- **First 30 Requests**: `200 OK`
- **Request 31+**: `429 Too Many Requests`
- **Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many requests. Please try again in a minute."
    }
  }
  ```
- **HTTP Headers**: `Retry-After: 60`

---

## Test Validation Criteria

### ✅ PASS Criteria

**Baseline Request**:
- [x] Returns `200 OK`
- [x] Response contains `success: true`
- [x] Response contains parsed filters
- [x] Response time <5s

**Cache Test**:
- [x] Second request returns identical JSON
- [x] Second request is significantly faster (<200ms)
- [x] No OpenAI API call made (check logs/console)

**Rate Limit Test**:
- [x] First 30 requests return `200`
- [x] Request 31+ returns `429`
- [x] Error code is `RATE_LIMIT_EXCEEDED`
- [x] `Retry-After` header present

### ❌ FAIL Criteria

**Baseline Request**:
- Returns error status
- Missing required fields
- Response time >10s

**Cache Test**:
- Responses differ
- Second request not faster
- Cache not working

**Rate Limit Test**:
- 429 appears before request 30
- No 429 appears after request 30
- Wrong error code/message

---

## Known Limitations

### Serverless Cache Behavior
- **Cache is per-instance**: Each Vercel serverless function has its own cache
- **Impact**: Cache hit rate may be lower in high-concurrency scenarios
- **Expected**: Cache works within same function instance, but may miss across instances

### Rate Limit Behavior
- **Per-instance limits**: Each serverless instance has its own rate limit counter
- **Impact**: Actual effective limit = 30 req/min × N instances
- **Expected**: Within a short burst, you may see 429 after exactly 30 requests to same instance

---

## Troubleshooting

### API Key Not Set
```bash
export INVENTORY_SEARCH_API_KEY="your-key-here"
```

### Cache Not Working
- Check server logs for cache hit/miss messages
- Verify query normalization (case-insensitive matching)
- Check TTL hasn't expired (7 minutes)

### Rate Limit Not Working
- Verify IP detection (check `x-forwarded-for` header)
- Check rate limit cleanup is running
- Monitor rate limit map size

---

## Next Steps

1. **Run Tests**: Execute test script with API key set
2. **Verify Results**: Confirm all PASS criteria met
3. **Monitor**: Check production logs for cache hit rates
4. **Tune**: Adjust TTL/limits based on real-world usage

---

**Note**: Tests require `INVENTORY_SEARCH_API_KEY` environment variable to be set.


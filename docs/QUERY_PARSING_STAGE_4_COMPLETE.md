# Stage 4 — Scale Prep Complete
## Query Parsing + Inventory Search Scale Preparation

**Date**: 2025-01-27  
**Status**: ✅ Complete

---

## Files Changed

### 1. Query Parse API
**`apps/dealer-dashboard/src/app/api/query/parse/route.ts`** (MODIFIED)
- Added in-memory caching for parsed queries
- Added per-IP rate limiting (30 req/min)
- Cache key normalization and TTL management
- Rate limit cleanup logic

### 2. Documentation
**`docs/QUERY_PARSING_SCALE_PREP.md`** (NEW)
- Comprehensive caching strategy documentation
- Rate limiting rules and behavior
- Database index recommendations
- Future OpenSearch option discussion
- Performance monitoring guidelines

---

## Behavior Summary

### Caching Behavior

**Cache Hit Flow**:
1. Request arrives with query: "Show me red SUVs under $40k"
2. Query normalized to cache key: "show me red suvs under $40k"
3. Cache lookup → **Hit** → Return cached result immediately
4. **No OpenAI API call** → Cost savings, faster response

**Cache Miss Flow**:
1. Request arrives with new query: "Find blue trucks"
2. Cache lookup → **Miss**
3. Call OpenAI API to parse query
4. Store result in cache with 7-minute TTL
5. Return parsed result

**Cache Management**:
- **TTL**: 7 minutes (configurable)
- **Cleanup**: Probabilistic cleanup every ~10th request
- **Eviction**: Expired entries removed automatically
- **Scope**: Per-serverless-instance (Vercel)

### Rate Limiting Behavior

**Within Limits**:
1. Request arrives from IP `1.2.3.4`
2. Check rate limit: 5 requests in last minute (within 30 req/min limit)
3. Allow request, increment counter
4. Process normally

**Rate Limited**:
1. Request arrives from IP `1.2.3.4`
2. Check rate limit: 35 requests in last minute (exceeds 30 req/min)
3. **Block request** → Return `429 Too Many Requests`
4. Response includes `Retry-After: 60` header

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in a minute."
  }
}
```

**Rate Limit Cleanup**:
- Old entries (>1 minute) removed automatically
- Cleanup runs probabilistically (every ~10th request)
- Memory-efficient sliding window

---

## Cache Strategy Details

### Cache Key Normalization
- **Input**: `"  Show me RED SUVs  "`
- **Normalized**: `"show me red suvs"`
- **Purpose**: Case-insensitive, whitespace-tolerant matching

### Cache TTL: 7 Minutes
**Rationale**:
- Balances freshness vs. cost savings
- Queries are relatively static (user intent doesn't change rapidly)
- Long enough to capture repeated searches
- Short enough to allow prompt improvements to propagate

**Cache Hit Rate Expectations**:
- **High**: Common queries ("red SUVs", "under $30k", "new cars")
- **Low**: Unique/long queries with specific details
- **Target**: >30% cache hit rate in production

### Memory Usage
- **Per Entry**: ~500 bytes (query + parsed result)
- **Estimate**: 2,000-5,000 entries per instance = ~1-2.5 MB
- **Acceptable**: Well within serverless memory limits

---

## Rate Limiting Details

### Limit: 30 Requests per Minute per IP
**Rationale**:
- Protects OpenAI API costs from abuse
- Allows legitimate users to explore (30 searches/minute is generous)
- Prevents single IP from monopolizing resources

### IP Detection
**Priority Order**:
1. `x-forwarded-for` header (first IP if comma-separated)
2. `x-real-ip` header
3. Fallback to `'unknown'` (all unknown IPs share limit)

**Vercel Production**: `x-forwarded-for` contains real client IP ✅

### Sliding Window
- **Window**: 60 seconds
- **Tracking**: Array of timestamps per IP
- **Cleanup**: Entries older than 60s removed automatically

**Example**:
- T=0: Request 1 (allowed)
- T=10: Request 2 (allowed, total: 2)
- T=20: Requests 3-30 (all allowed, total: 30)
- T=25: Request 31 → **RATE LIMITED** (30 in last 25s)
- T=65: Request 32 (allowed, T=0 request expired)

---

## Database Index Recommendations

### Recommended Additional Indexes

#### 1. Bounds Query Optimization
```sql
-- Composite index for bounds + availability (most common pattern)
create index if not exists idx_uvs_vehicles_bounds_available 
  on uvs_vehicles(dealer_latitude, dealer_longitude, availability_status) 
  where dealer_latitude is not null 
    and dealer_longitude is not null 
    and availability_status = 'available';
```

**Benefit**: Optimizes the most common query pattern (bounds + filters)

#### 2. Common Filter Combinations
```sql
-- Make + Model + Condition
create index if not exists idx_uvs_vehicles_make_model_condition 
  on uvs_vehicles(make, model, condition) 
  where availability_status = 'available';
```

**Benefit**: Fast filtering for common query patterns

#### 3. Miles Filtering
```sql
-- Miles index for maxMiles filtering
create index if not exists idx_uvs_vehicles_miles 
  on uvs_vehicles(miles) 
  where availability_status = 'available' 
    and miles is not null;
```

**Benefit**: Enables efficient maxMiles filtering (currently may be slow)

### Index Impact
- **Read Performance**: 2-5x faster queries for indexed columns
- **Write Performance**: Minimal impact (~5-10% slower inserts)
- **Storage**: ~10-20% additional index storage

---

## Risks & Limitations

### Caching Limitations

1. **Serverless Statelessness**
   - **Issue**: Cache is per-instance, not shared
   - **Impact**: Cache hit rate lower in high-concurrency scenarios
   - **Mitigation**: Consider Redis for distributed caching at scale
   - **Risk Level**: Low (acceptable for current scale)

2. **Memory Growth**
   - **Issue**: Cache grows unbounded (up to cleanup)
   - **Impact**: Memory pressure with many unique queries
   - **Mitigation**: Probabilistic cleanup, TTL expiration
   - **Risk Level**: Low (cleanup handles this)

### Rate Limiting Limitations

1. **Shared IPs**
   - **Issue**: NAT/corporate networks share one IP
   - **Impact**: Legitimate users may be rate limited
   - **Mitigation**: Consider API-key-based limits for authenticated users
   - **Risk Level**: Low (30 req/min is generous)

2. **Per-Instance Limits**
   - **Issue**: Rate limit is per-instance, not global
   - **Impact**: Actual limit = 30 req/min × N instances
   - **Mitigation**: Redis-based rate limiting for accurate limits
   - **Risk Level**: Medium (acceptable for current scale, monitor)

3. **IP Spoofing**
   - **Issue**: `x-forwarded-for` can be spoofed (if not behind proxy)
   - **Impact**: Rate limit bypass possible
   - **Mitigation**: Vercel/Cloudflare validate headers, risk low
   - **Risk Level**: Low (Vercel validates headers)

### Database Limitations

1. **Index Maintenance Overhead**
   - **Issue**: More indexes = slower writes
   - **Impact**: Sync/ingestion jobs may slow down
   - **Mitigation**: Monitor write performance, use partial indexes
   - **Risk Level**: Low (monitor and adjust)

2. **Query Complexity**
   - **Issue**: Complex queries may not use indexes optimally
   - **Impact**: Slow queries despite indexes
   - **Mitigation**: Use `EXPLAIN ANALYZE`, optimize queries
   - **Risk Level**: Low (monitor query performance)

---

## Performance Expectations

### Query Parse API

**Cached Requests**:
- Response time: <50ms
- Cost: $0 (no OpenAI API call)
- Throughput: Limited by rate limiting

**Uncached Requests**:
- Response time: 1-3s (OpenAI API call)
- Cost: ~$0.0001-0.0003 per request (gpt-4o-mini)
- Throughput: Limited by rate limiting + OpenAI rate limits

**Rate Limited**:
- Response time: <10ms (immediate rejection)
- Cost: $0
- Throughput: 30 req/min per IP

### Inventory Search API

**Without Recommended Indexes**:
- Query time: 200-500ms (depending on dataset size)
- Throughput: Limited by database connection pool

**With Recommended Indexes**:
- Query time: 50-200ms (2-5x improvement)
- Throughput: Improved (faster queries = more capacity)

---

## Future Enhancements

### Short-term (1-3 months)
- ⚠️ Monitor cache hit rates, adjust TTL if needed
- ⚠️ Add recommended database indexes
- ⚠️ Consider Redis caching if cache hit rate <20%

### Medium-term (3-6 months)
- ⚠️ Redis-based rate limiting for accurate per-IP limits
- ⚠️ Query result caching for inventory search (if needed)
- ⚠️ Read replicas for database scaling

### Long-term (6+ months)
- ⚠️ Evaluate OpenSearch for >1M vehicles
- ⚠️ CDN caching for static vehicle data
- ⚠️ Edge caching for common queries

---

## Configuration

### Current Settings
```typescript
const CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes
const RATE_LIMIT_REQUESTS = 30; // 30 requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
```

### Tuning Recommendations
- **Cache TTL**: Increase if cache hit rate >50%, decrease if <20%
- **Rate Limit**: Increase if legitimate users hit limit, decrease if costs spike
- **Cleanup Frequency**: Adjust based on memory usage

---

## Testing Checklist

- [x] Cache stores parsed results correctly
- [x] Cache returns cached results on repeat queries
- [x] Cache expires after TTL
- [x] Rate limiting blocks excessive requests
- [x] Rate limiting allows requests within limits
- [x] Rate limit cleanup removes old entries
- [x] Error responses include correct codes/messages
- [x] IP detection works with x-forwarded-for header

---

## Summary

✅ **Caching**: In-memory cache with 7-minute TTL implemented  
✅ **Rate Limiting**: Per-IP limit of 30 req/min implemented  
✅ **Documentation**: Comprehensive scale prep guide created  
✅ **Index Recommendations**: Database optimization suggestions documented  

**Ready for production use** ✅


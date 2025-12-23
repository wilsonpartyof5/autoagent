# Query Parsing Scale Prep Documentation
## Caching, Rate Limiting, and Database Optimization

**Date**: 2025-01-27  
**Status**: ✅ Complete

---

## Overview

This document describes the scale preparation strategies for the query parsing and inventory search APIs, including caching, rate limiting, and database optimization recommendations.

---

## 1. Query Parse Caching Strategy

### Implementation
- **Type**: In-memory cache (Map-based)
- **Location**: `apps/dealer-dashboard/src/app/api/query/parse/route.ts`
- **TTL**: 7 minutes (420,000 ms)
- **Key**: Normalized query string (lowercase, trimmed)

### Cache Behavior
- **Hit**: Returns cached result immediately, skips OpenAI API call
- **Miss**: Calls OpenAI API, stores result in cache
- **Eviction**: Expired entries removed automatically every 5 minutes
- **Scope**: Per-server instance (stateless across instances)

### Cache Key Normalization
```typescript
function normalizeQueryForCache(query: string): string {
  return query.toLowerCase().trim();
}
```

**Examples**:
- `"Show me red SUVs"` → `"show me red suvs"`
- `"  Show me RED SUVs  "` → `"show me red suvs"` (same key)

### Cache Size Management
- **Automatic cleanup**: Runs every 5 minutes
- **Memory consideration**: Cache entries are small (~500 bytes each)
- **Estimated capacity**: ~2,000-5,000 entries per server instance

### Cache Invalidation
- **Time-based**: 7-minute TTL (configurable)
- **Manual**: Server restart clears cache
- **Future enhancement**: Consider Redis for distributed caching

---

## 2. Rate Limiting

### Implementation
- **Type**: Per-IP rate limiting (in-memory)
- **Location**: `apps/dealer-dashboard/src/app/api/query/parse/route.ts`
- **Limit**: 30 requests per minute per IP
- **Window**: 60-second sliding window

### Rate Limit Behavior
- **Within limit**: Request processed normally
- **Exceeded**: Returns `429 Too Many Requests` with error code `RATE_LIMIT_EXCEEDED`
- **Headers**: Includes `Retry-After: 60` header

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in a minute."
  }
}
```

**HTTP Status**: `429`

### IP Detection
The rate limiter uses the following headers (in order):
1. `x-forwarded-for` (first IP if comma-separated)
2. `x-real-ip`
3. Falls back to `'unknown'` (all unknown IPs share one limit)

**Note**: In production (Vercel), `x-forwarded-for` will contain the real client IP.

### Rate Limit Cleanup
- **Automatic cleanup**: Runs every 5 minutes
- **Removes**: Entries older than 1 minute
- **Memory**: Minimal impact (~100 bytes per IP)

### Future Enhancements
- Redis-based rate limiting for distributed systems
- Per-API-key rate limits (if needed)
- Configurable limits per environment (staging vs production)

---

## 3. Database Index Recommendations

### Current Indexes (from `20250228_create_uvs_vehicles.sql`)

```sql
-- Single column indexes
create index if not exists idx_uvs_vehicles_vin on uvs_vehicles(vin) where vin is not null;
create index if not exists idx_uvs_vehicles_year on uvs_vehicles(year);
create index if not exists idx_uvs_vehicles_make_model on uvs_vehicles(make, model);
create index if not exists idx_uvs_vehicles_dealer_name on uvs_vehicles(dealer_name);
create index if not exists idx_uvs_vehicles_dealer_id on uvs_vehicles(dealer_id) where dealer_id is not null;
create index if not exists idx_uvs_vehicles_condition on uvs_vehicles(condition);
create index if not exists idx_uvs_vehicles_price on uvs_vehicles(price);
create index if not exists idx_uvs_vehicles_availability_status on uvs_vehicles(availability_status);
create index if not exists idx_uvs_vehicles_location on uvs_vehicles(dealer_latitude, dealer_longitude) where dealer_latitude is not null and dealer_longitude is not null;

-- Composite indexes
create index if not exists idx_uvs_vehicles_search_make_model_year on uvs_vehicles(make, model, year);
create index if not exists idx_uvs_vehicles_search_price_range on uvs_vehicles(price) where availability_status = 'available';
create index if not exists idx_uvs_vehicles_search_condition_price on uvs_vehicles(condition, price) where availability_status = 'available';

-- GIN index for JSONB
create index if not exists idx_uvs_vehicles_uvs_data_gin on uvs_vehicles using gin(uvs_data);
```

### Recommended Additional Indexes for Scale

#### 1. Bounds Query Optimization
The inventory search API heavily uses bounds-based queries. Consider:

```sql
-- Composite index for bounds + availability (most common query pattern)
create index if not exists idx_uvs_vehicles_bounds_available 
  on uvs_vehicles(dealer_latitude, dealer_longitude, availability_status) 
  where dealer_latitude is not null 
    and dealer_longitude is not null 
    and availability_status = 'available';

-- Partial index for bounds + price range (common filter combination)
create index if not exists idx_uvs_vehicles_bounds_price 
  on uvs_vehicles(dealer_latitude, dealer_longitude, price) 
  where dealer_latitude is not null 
    and dealer_longitude is not null 
    and availability_status = 'available';
```

#### 2. Common Filter Combinations
Based on query parsing patterns:

```sql
-- Make + Model + Condition (common filter combination)
create index if not exists idx_uvs_vehicles_make_model_condition 
  on uvs_vehicles(make, model, condition) 
  where availability_status = 'available';

-- Year range + Price (common filter)
create index if not exists idx_uvs_vehicles_year_price 
  on uvs_vehicles(year, price) 
  where availability_status = 'available';

-- Condition + Year + Price (very common)
create index if not exists idx_uvs_vehicles_condition_year_price 
  on uvs_vehicles(condition, year, price) 
  where availability_status = 'available';
```

#### 3. Miles Filtering
Currently `miles` is stored but may not be indexed:

```sql
-- Miles index for maxMiles filtering
create index if not exists idx_uvs_vehicles_miles 
  on uvs_vehicles(miles) 
  where availability_status = 'available' 
    and miles is not null;
```

### Index Maintenance
- **Monitor**: Query performance via Supabase dashboard
- **Analyze**: Use `EXPLAIN ANALYZE` for slow queries
- **Reindex**: Periodically run `REINDEX` during low-traffic periods

---

## 4. Caching Strategy for Inventory Search

### Current State
- **No caching**: Each request hits the database directly
- **Reason**: Map bounds change frequently, cache invalidation complex

### Recommended Caching (Future)

#### Option 1: Query Result Caching
**When to cache**: Exact same bounds + filters combination
**TTL**: 2-5 minutes
**Key**: `bounds:{north}-{south}-{east}-{west}:filters:{hash}`

**Challenges**:
- Bounds are continuous (rarely exact matches)
- Cache hit rate likely low

#### Option 2: Filter-Only Caching
**When to cache**: Same filters, different bounds
**Strategy**: Cache filtered vehicle IDs, apply bounds filtering in-memory

**Trade-offs**:
- Requires loading more data into memory
- Complex invalidation

#### Option 3: Redis Caching
**Use case**: High-traffic scenarios
**Strategy**: Cache by dealer_id + filters (if applicable)

**Recommendation**: Implement when:
- >100 requests/second sustained
- Database query time >200ms average
- Cache hit rate analysis shows >20% potential

---

## 5. Future OpenSearch Option

### When to Consider OpenSearch
- **Scale**: >1M vehicles in database
- **Search patterns**: Complex full-text search (keywords in descriptions, features)
- **Performance**: Sub-100ms search requirements

### Benefits
- **Full-text search**: Search across vehicle descriptions, features
- **Faceted search**: Efficient filtering with aggregations
- **Geospatial**: Native support for location-based queries
- **Scalability**: Horizontal scaling

### Migration Path
1. **Phase 1**: Keep Supabase as source of truth
2. **Phase 2**: Sync UVS data to OpenSearch (change stream or batch)
3. **Phase 3**: Route queries through OpenSearch
4. **Phase 4**: Use Supabase only for writes, OpenSearch for reads

### OpenSearch Schema (Example)
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "make": { "type": "keyword" },
      "model": { "type": "keyword" },
      "year": { "type": "integer" },
      "price": { "type": "integer" },
      "condition": { "type": "keyword" },
      "location": {
        "type": "geo_point"
      },
      "description": {
        "type": "text",
        "analyzer": "standard"
      },
      "features": {
        "type": "keyword"
      }
    }
  }
}
```

---

## 6. Performance Monitoring

### Metrics to Track

#### Query Parse API
- **Cache hit rate**: Target >30% for common queries
- **Average response time**: Target <100ms (cached), <2s (uncached)
- **Rate limit hits**: Monitor for abuse patterns
- **OpenAI API errors**: Track for cost and reliability

#### Inventory Search API
- **Database query time**: Target <200ms for bounds queries
- **Response size**: Monitor for large result sets
- **Cache potential**: Analyze query patterns for caching opportunities

### Recommended Tools
- **Vercel Analytics**: Request duration, error rates
- **Supabase Dashboard**: Query performance, slow queries
- **OpenAI Usage Dashboard**: API costs, error rates

---

## 7. Current Limitations & Risks

### Caching Limitations
1. **Stateless**: Cache is per-server instance (Vercel serverless)
   - **Impact**: Low cache hit rate in high-concurrency scenarios
   - **Mitigation**: Consider Redis for distributed caching at scale

2. **Memory**: In-memory cache grows unbounded
   - **Impact**: Server memory pressure with many unique queries
   - **Mitigation**: Periodic cleanup (implemented), consider LRU eviction

### Rate Limiting Limitations
1. **IP-based**: Shared IPs (NAT, corporate networks) share limits
   - **Impact**: Legitimate users may be rate limited
   - **Mitigation**: Consider API-key-based limits for authenticated users

2. **Stateless**: Rate limit state is per-server instance
   - **Impact**: Limit is per-instance, not global (30 req/min × N instances)
   - **Mitigation**: Redis-based rate limiting for accurate limits

### Database Limitations
1. **Single region**: All queries hit primary database
   - **Impact**: Latency for distant users
   - **Mitigation**: Read replicas or CDN caching

2. **Index maintenance**: More indexes = slower writes
   - **Impact**: Sync/ingestion jobs may slow down
   - **Mitigation**: Monitor write performance, use partial indexes

---

## 8. Recommendations Summary

### Immediate (Current Implementation)
- ✅ In-memory cache with 7-minute TTL
- ✅ Per-IP rate limiting (30 req/min)
- ✅ Existing database indexes

### Short-term (Next 1-3 months)
- ⚠️ Add recommended composite indexes for bounds queries
- ⚠️ Monitor cache hit rates and adjust TTL
- ⚠️ Add Redis caching if cache hit rate <20%

### Medium-term (3-6 months)
- ⚠️ Redis-based rate limiting for accurate per-IP limits
- ⚠️ Query result caching for inventory search (if needed)
- ⚠️ Read replicas for database scaling

### Long-term (6+ months)
- ⚠️ Evaluate OpenSearch for >1M vehicles
- ⚠️ CDN caching for static vehicle data
- ⚠️ Edge caching for common queries

---

## Appendix: Configuration

### Environment Variables
Required environment variables:
- `OPENAI_API_KEY` - For query parsing
- `INVENTORY_SEARCH_API_KEY` - For API authentication
- `MAPBOX_ACCESS_TOKEN` - For geocoding location mentions in queries (required for location parsing)

### Tuning Parameters
Located in `route.ts`:
```typescript
const CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes
const RATE_LIMIT_REQUESTS = 30; // 30 requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
```

Adjust these based on:
- Cache hit rate analysis
- Rate limit violation frequency
- OpenAI API cost optimization


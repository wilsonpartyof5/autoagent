# Phase 4 Line-Item Fixes - Implementation Status

## Critical Fixes Applied

### ✅ 1. Sessions & Required IDs (Critical)

**Dashboard Session Persistence**:
- ✅ Middleware sets `aa_session_id` cookie on every request
- ✅ Tracking server reads session from cookie (`cookies().get()`)
- ✅ Session persists across requests (30-minute cookie)

**MCP Session Handling**:
- ✅ `session_id` is nullable in schema (no FK constraint)
- ✅ Uses `requestId` as `sessionId` for request-level correlation
- ✅ No new session IDs generated per event (reuses requestId)

**Required ID Enforcement**:
- ✅ Validation function checks required IDs per event type
- ✅ **FAIL FAST**: Returns early (skips logging) if required IDs missing
- ✅ Applied before insert in both MCP and Dashboard trackers

**Files Changed**:
- `apps/dealer-dashboard/src/middleware.ts` - Sets cookie
- `apps/dealer-dashboard/src/lib/analytics/tracking-server.ts` - Reads cookie, fails fast
- `apps/mcp-server/src/lib/analytics/tracking.ts` - Fails fast

### ✅ 2. Schema Alignment

**Source Field**:
- ✅ `source TEXT NOT NULL` in schema
- ✅ All tracking calls set source ('dashboard', 'mcp-server', 'widget')

**Sessions Optional**:
- ✅ `session_id` is nullable in schema
- ✅ Materialized views handle null sessions with `where session_id is not null`

**Anonymous Search Rules**:
- ✅ Schema allows `dealer_id IS NULL` for anonymous searches
- ✅ Validation allows missing dealer_id for `inventory.search` events
- ⚠️ **TODO**: Add CHECK constraint or comment documenting this rule

**Files Changed**:
- `apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_tables.sql`

### ⚠️ 3. Tracking Coverage (Partial)

**Widget Tracking**:
- ❌ vehicle.view - Not yet added to widget HTML
- ❌ vehicle.click - Not yet added to widget HTML
- ✅ Created `/widget/track` endpoint for widget tracking

**Dashboard Tracking**:
- ✅ dashboard.inventory.status_change - Already tracked
- ❌ dashboard.inventory.edit - Need to find edit functionality
- ❌ dashboard.inventory.delete - Need to find delete functionality
- ✅ system.error - Added to error handlers

**Files Changed**:
- `apps/mcp-server/src/app/widget-tracking.ts` - New endpoint
- `apps/mcp-server/src/index.ts` - Error middleware tracks errors
- `apps/mcp-server/src/mcp-handler.ts` - Error handler tracks errors

### ⚠️ 4. Materialized Views Refresh

**Current Status**:
- ✅ Created `refresh_analytics_views_safe()` function
- ✅ Created `/api/analytics/refresh` endpoint
- ✅ Added trigger-based refresh (after 100 events)
- ❌ **TODO**: Wire up pg_cron or document external scheduler setup

**Files Changed**:
- `apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_views.sql`
- `apps/dealer-dashboard/src/app/api/analytics/refresh/route.ts`

### ⚠️ 5. KPIs and Endpoints

**Current Status**:
- ✅ Removed placeholder metrics (set to `null` instead of `0`)
- ✅ KPIs degrade gracefully (null for unavailable data)
- ❌ **TODO**: Remove vehicle.compare from queries if feature doesn't exist
- ⚠️ Queries assume dealer_id exists - need to handle anonymous events

**Files Changed**:
- `apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts`

### ✅ 6. Payload Validation / PII

**Current Status**:
- ✅ Strict allowlists per event type
- ✅ PII pattern detection (email/phone)
- ✅ Removed all IP/user-agent options
- ✅ Validators reject unexpected fields

**Files Changed**:
- `packages/shared/src/analytics-validators.ts`

## Remaining Work

### High Priority
1. **Widget Tracking**: Add vehicle.view and vehicle.click tracking to widget HTML
2. **Dashboard Edit/Delete**: Find and track inventory edit/delete actions
3. **Vehicle Compare**: Remove from all code if feature doesn't exist
4. **Refresh Scheduling**: Document or wire up pg_cron

### Medium Priority
1. **Anonymous Search Rules**: Add CHECK constraint or documentation
2. **KPI Queries**: Handle anonymous events (where dealer_id is null)

## Next Steps

1. Add widget tracking JavaScript to vehicle-results.html
2. Find dashboard inventory edit/delete functions and add tracking
3. Remove vehicle.compare references if feature doesn't exist
4. Document materialized view refresh scheduling


# Phase 4 Critical Fixes - Status Report

## Overview

This document tracks the systematic fixes to address all critical issues identified in the Phase 4 audit.

## Completed Fixes ✅

### 1. Schema Improvements
- ✅ Added `source` field to `analytics_events` table (required, indexed)
- ✅ Added validation constraints (source must be one of: mcp-server, dashboard, widget, system)
- ✅ Added check constraints for vehicle fields (vin required when vehicle_id provided)
- ✅ Added check constraints for dealer-scoped events (dealer_id required except system events)
- ✅ Removed IP address and user agent columns from all tables

### 2. Tracking Utilities - Core Improvements
- ✅ Removed all PII options (ipAddress, userAgent) from function signatures
- ✅ Created strict allowlist-based payload validators (`analytics-validators.ts`)
- ✅ Implemented payload validation against allowed fields per event type
- ✅ Implemented payload sanitization (removes disallowed fields)
- ✅ Added `source` field to all event inserts
- ✅ Implemented cookie-based session management for dashboard (30-minute sessions)
- ✅ Implemented request-level session correlation for MCP server

### 3. Updated Tracking Calls
- ✅ Removed PII context from all MCP tool functions
- ✅ Updated searchVehicles to use requestId for session correlation
- ✅ Updated submitLead to use requestId for session correlation
- ✅ Removed ipAddress/userAgent from all interfaces

## In Progress / Remaining Work 🔄

### 4. Missing Tracking Points

**Vehicle View/Click/Widget Tracking:**
- Need to add `vehicle.view` tracking when vehicles are displayed in widget
- Need to add `vehicle.click` tracking on vehicle interactions
- Widget endpoint needs to track view events

**System Error Tracking:**
- Need to wrap error handlers to track `system.error` events
- Add error tracking to MCP server error handlers
- Add error tracking to dashboard error boundaries

**Inventory Actions:**
- Inventory delete tracking (if delete functionality exists)
- Full inventory edit tracking (beyond status changes)

### 5. Materialized View Refresh Strategy

**Current Status:** Placeholder function exists

**Needed:**
- Set up pg_cron extension in Supabase
- Create scheduled job to refresh views every 15 minutes
- OR implement trigger-based refresh (performance consideration)
- Document refresh strategy

### 6. KPI Endpoint Cleanup

**Current Issues:**
- Queries `system.error` events that aren't tracked yet
- Placeholder metrics (marketShare, leadQualityScore, etc.) return 0
- Internal reliability KPIs depend on system.error tracking

**Needed:**
- Remove or conditionally show placeholder metrics
- Add system.error tracking first, then enable reliability KPIs
- Document which KPIs are active vs. placeholder

### 7. Schema Constraints - Enforcement

**Current Status:** Constraints defined but may need refinement

**Needed:**
- Test constraints work correctly
- Ensure session_id can be null for system events
- Verify dealer_id requirements work for all event types

## Files Modified

### Core Tracking
1. ✅ `apps/mcp-server/src/lib/analytics/tracking.ts` - Complete rewrite
2. ✅ `apps/dealer-dashboard/src/lib/analytics/tracking.ts` - Complete rewrite
3. ✅ `packages/shared/src/analytics-validators.ts` - New file

### Schema
4. ✅ `apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_tables.sql` - Updated

### MCP Tools
5. ✅ `apps/mcp-server/src/tools/searchVehicles.ts` - Updated
6. ✅ `apps/mcp-server/src/tools/submitLead.ts` - Updated
7. ✅ `apps/mcp-server/src/mcp-simple.ts` - Updated
8. ✅ `apps/mcp-server/src/mcp-handler.ts` - Updated

### Dashboard
9. ✅ `apps/dealer-dashboard/src/app/app/settings/actions.ts` - Already has tracking
10. ✅ `apps/dealer-dashboard/src/app/app/inventory/actions.ts` - Already has tracking
11. ✅ `apps/dealer-dashboard/src/middleware.ts` - Already has tracking

### Shared Package
12. ✅ `packages/shared/src/index.ts` - Exports validators

## Next Steps (Priority Order)

### High Priority
1. **Add system.error tracking** - Wrap error handlers in MCP and dashboard
2. **Fix materialized view refresh** - Set up pg_cron or alternative strategy
3. **Add vehicle view/click tracking** - In widget and dashboard

### Medium Priority
4. **Clean up KPI endpoint** - Remove placeholders or conditionally show
5. **Add inventory delete tracking** - If delete functionality exists
6. **Test all constraints** - Verify schema constraints work correctly

### Low Priority
7. **Document refresh strategy** - Create setup guide
8. **Performance testing** - Verify materialized views perform well

## Testing Checklist

- [ ] Events insert successfully with source field
- [ ] Session cookies work in dashboard (sessions persist)
- [ ] Request-level sessions work in MCP (correlation works)
- [ ] Payload validation rejects invalid fields
- [ ] PII sanitization removes disallowed fields
- [ ] Schema constraints enforce required fields
- [ ] Materialized views refresh successfully
- [ ] KPI endpoint returns accurate data
- [ ] System error tracking captures errors

## Notes

- Vehicle comparison feature doesn't exist in codebase - cannot track what doesn't exist
- Some placeholder KPIs may be intentional for future features
- Materialized view refresh requires Supabase configuration (pg_cron extension)

---

**Status:** Core fixes complete. Remaining work is incremental improvements and testing.


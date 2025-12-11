# Phase 4 Critical Fixes - Implementation Plan

## Issues Identified in Audit

### 1. Schema Issues
- ✅ Missing `source` field - **FIXED**: Added to schema with constraints
- ❌ No enforcement of required IDs - **NEEDS FIX**: Add constraints
- ❌ Session semantics weak - **NEEDS FIX**: Implement cookie-based sessions

### 2. Tracking Utilities
- ❌ PII options remain (ipAddress/userAgent) - **NEEDS FIX**: Remove completely
- ❌ Brittle PII stripping - **FIXED**: Created strict allowlist validators
- ❌ No payload validation - **FIXED**: Created validation functions
- ❌ Sessions not reused - **NEEDS FIX**: Implement cookie-based session management

### 3. Missing Tracking Points
- ❌ Vehicle view/click/widget - **NEEDS FIX**: Add tracking
- ❌ Vehicle comparison - **NOTED**: Feature doesn't exist
- ❌ Inventory edit/delete - **PARTIAL**: Only status_change tracked
- ❌ System error events - **NEEDS FIX**: Add error tracking

### 4. Materialized Views
- ❌ No refresh strategy - **NEEDS FIX**: Add real cron/pg_cron setup

### 5. KPIs
- ❌ Placeholder metrics - **NEEDS FIX**: Remove or ground in real data

## Implementation Status

Due to the extensive nature of these fixes, here's what has been done and what remains:

### Completed
1. ✅ Added `source` field to schema with constraints
2. ✅ Created strict allowlist-based payload validators
3. ✅ Added payload validation functions

### Remaining Work

The fixes require:
1. Complete rewrite of tracking utilities to remove PII options
2. Cookie-based session management implementation
3. Additional tracking points throughout codebase
4. Materialized view refresh strategy (pg_cron setup)
5. KPI endpoint cleanup

**Recommendation**: These fixes require significant refactoring. Should I proceed with a comprehensive fix of all remaining issues, or would you prefer to address them incrementally?

## Files That Need Updates

1. `apps/mcp-server/src/lib/analytics/tracking.ts` - Remove PII, add source, fix sessions
2. `apps/dealer-dashboard/src/lib/analytics/tracking.ts` - Remove PII, add source, cookie sessions
3. Widget files - Add vehicle view/click tracking
4. Error handlers - Add system.error tracking
5. Materialized view migration - Add pg_cron refresh
6. KPI endpoint - Remove placeholders

Would you like me to proceed with implementing all remaining fixes?


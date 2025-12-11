# Phase 4: Remaining Issues - Feature Gaps Documented

## Summary

Some event types are defined but the corresponding functionality doesn't exist in the codebase. This document clarifies the status of these features.

---

## ⚠️ Feature Gaps

### 1. Vehicle Compare Feature

**Status**: ❌ **FEATURE DOESN'T EXIST**

**Event Type**: `vehicle.compare`

**Current State**:
- Event type defined in `packages/shared/src/analytics.ts`
- Validator allows `vehicle.compare` events
- Schema constraints enforce `dealer_id` and `session_id` for compare events
- **No comparison functionality found in codebase**

**Options**:
1. **Remove event type** - If feature will not be implemented, remove `vehicle.compare` from:
   - `packages/shared/src/analytics.ts` (EventName union)
   - `packages/shared/src/analytics-validators.ts` (ALLOWED_FIELDS)
   - `packages/shared/src/analytics-tracking-core.ts` (REQUIRED_IDS)
   - Schema CHECK constraints in `20250301_create_analytics_tables.sql`
   - Materialized views that query `vehicle.compare` events

2. **Keep for future** - If feature is planned, keep event type for future implementation

**Recommendation**: Remove if feature won't be implemented to avoid confusion.

---

### 2. Dashboard Inventory Edit Feature

**Status**: ❌ **FEATURE DOESN'T EXIST**

**Event Type**: `dashboard.inventory.edit`

**Current State**:
- Event type defined in `packages/shared/src/analytics.ts`
- Validator allows `dashboard.inventory.edit` events
- Schema constraints enforce required IDs
- **Only status changes are tracked** - no edit functionality found

**Current Functionality**:
- ✅ `dashboard.inventory.status_change` - Tracked in `apps/dealer-dashboard/src/app/app/inventory/actions.ts`
- ❌ `dashboard.inventory.edit` - No edit functionality found
- ❌ `dashboard.inventory.delete` - No delete functionality found

**Options**:
1. **Remove event types** - If edit/delete won't be implemented
2. **Keep for future** - If planned for future implementation

**Recommendation**: Keep for now if edit/delete functionality is planned.

---

### 3. Dashboard Inventory Delete Feature

**Status**: ❌ **FEATURE DOESN'T EXIST**

**Event Type**: `dashboard.inventory.delete`

**Current State**: Same as edit - event type defined but no delete functionality exists.

---

## ✅ Implemented Features

- ✅ `dashboard.inventory.status_change` - Live/not-live status changes
- ✅ `vehicle.view` - Widget and search results
- ✅ `vehicle.click` - Widget interactions
- ✅ `lead.submit` - Lead submission tracking
- ✅ `inventory.search` - Search tracking

---

## Action Items

1. **Decision Required**: Remove `vehicle.compare` if feature won't be implemented
2. **Decision Required**: Keep or remove `dashboard.inventory.edit`/`delete` based on roadmap
3. **Update Documentation**: Document which events are tracked vs. planned


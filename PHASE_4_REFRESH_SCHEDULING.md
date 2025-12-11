# Phase 4: Materialized View Refresh Scheduling

## Operational Refresh Strategy

Materialized views require periodic refresh to stay current. We provide multiple options:

### Option 1: External Cron (Recommended)

Use Vercel Cron, Railway Cron, or any external scheduler to call the refresh endpoint:

```bash
# Example: Refresh every 15 minutes
curl -X POST https://your-domain.com/api/analytics/refresh \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN"
```

**Setup Instructions**:
1. Set `ANALYTICS_REFRESH_TOKEN` environment variable
2. Configure external cron service (Vercel Cron, Railway Cron, etc.)
3. Schedule POST request to `/api/analytics/refresh` every 15 minutes

**Vercel Cron Example** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/analytics/refresh",
    "schedule": "*/15 * * * *"
  }]
}
```

### Option 2: Trigger-Based Refresh (Automatic)

The database includes a trigger-based refresh mechanism:
- Refreshes views after 100 events (configurable via `analytics_refresh_state.refresh_threshold`)
- Minimum 5 minutes between refreshes
- Runs asynchronously (doesn't block event inserts)

**Configuration**:
```sql
-- Adjust threshold (default: 100 events)
UPDATE analytics_refresh_state 
SET refresh_threshold = 200 
WHERE refresh_threshold = 100;

-- Check current state
SELECT * FROM analytics_refresh_state;
```

### Option 3: pg_cron (Supabase Pro)

If using Supabase Pro with pg_cron extension enabled:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh every 15 minutes
SELECT cron.schedule(
  'refresh-analytics-views',
  '*/15 * * * *', -- Every 15 minutes
  'SELECT refresh_analytics_views_safe();'
);

-- List scheduled jobs
SELECT * FROM cron.job;

-- Unschedule (if needed)
SELECT cron.unschedule('refresh-analytics-views');
```

## Current Configuration

- **Trigger-based**: Active (refreshes after 100 events, min 5 min interval)
- **API Endpoint**: Available at `/api/analytics/refresh`
- **Manual Refresh**: Can call `SELECT refresh_analytics_views_safe();` in Supabase SQL editor

## Recommended Production Setup

1. **Primary**: External cron calling `/api/analytics/refresh` every 15 minutes
2. **Backup**: Trigger-based refresh for automatic refresh on high activity
3. **Monitoring**: Check `analytics_refresh_state` table to monitor refresh frequency

## Monitoring Refresh Status

```sql
-- Check last refresh time
SELECT last_refresh, event_count_since_refresh, refresh_threshold 
FROM analytics_refresh_state;

-- Check view staleness (if views have last refresh metadata)
SELECT schemaname, matviewname, last_refresh 
FROM pg_stat_user_matviews 
WHERE matviewname LIKE 'analytics_%';
```


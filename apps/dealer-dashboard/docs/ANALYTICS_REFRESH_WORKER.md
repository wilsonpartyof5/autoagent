# Analytics Refresh Worker

This document describes how to run and configure the analytics materialized view refresh mechanism.

## Overview

The analytics system uses materialized views to provide fast KPI queries. These views need to be refreshed periodically to stay current with new analytics events.

**All 7 materialized views are refreshed:**
- `daily_leads_per_dealer`
- `weekly_metrics_per_dealer`
- `monthly_metrics_per_dealer`
- `search_to_lead_conversion`
- `inventory_engagement`
- `filter_usage_stats`
- `last_30_days_activity`

## Refresh Mechanisms

### Option 1: Node.js Worker (Recommended for Development)

A Node.js worker that polls every 15 minutes to check if refresh is needed.

#### Running the Worker

```bash
# From the dealer-dashboard directory
cd apps/dealer-dashboard

# Install dependencies (if not already installed)
pnpm install

# Run the worker
pnpm worker:analytics-refresh
```

Or using npm:
```bash
npm run worker:analytics-refresh
```

#### Environment Variables

The worker requires these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Optional (for LISTEN/NOTIFY support):
```bash
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/postgres
```

#### Worker Features

- **Polling**: Checks every 15 minutes if refresh is needed
- **LISTEN/NOTIFY**: Optionally listens for PostgreSQL NOTIFY events (requires `pg` library and `DATABASE_URL`)
- **Logging**: Detailed logs for each refresh operation, including per-view success/failure
- **Graceful Shutdown**: Handles SIGTERM/SIGINT to stop cleanly

#### Worker Logs

The worker logs detailed information:
- Refresh status (refreshed or skipped)
- Event count vs threshold
- Per-view refresh results (success/error)
- Duration of each refresh operation

Example log output:
```
[analytics-refresh-worker] ✅ Refresh completed successfully
[analytics-refresh-worker] Event count: 150/100
[analytics-refresh-worker] Views refreshed: 7 success, 0 errors
[analytics-refresh-worker] ✅ View daily_leads_per_dealer refreshed successfully
[analytics-refresh-worker] ✅ View search_to_lead_conversion refreshed successfully
...
```

### Option 2: pg_cron (Recommended for Production)

If you have access to pg_cron extension (Supabase Pro or self-hosted PostgreSQL):

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh every 15 minutes
SELECT cron.schedule(
  'refresh-analytics-views',
  '*/15 * * * *', -- Every 15 minutes
  $$SELECT check_and_refresh_analytics_views();$$
);

-- List scheduled jobs
SELECT * FROM cron.job;

-- Unschedule (if needed)
SELECT cron.unschedule('refresh-analytics-views');
```

**Note**: pg_cron requires superuser privileges. In Supabase, you can enable it from the Dashboard > Database > Extensions.

### Option 3: External Cron (Vercel, Railway, etc.)

Use an external cron service to call the refresh API endpoint:

```bash
# Example: Refresh every 15 minutes
curl -X POST https://your-domain.com/api/analytics/refresh \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN"
```

#### Vercel Cron Example

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/analytics/refresh",
    "schedule": "*/15 * * * *"
  }]
}
```

Set environment variable:
```bash
ANALYTICS_REFRESH_TOKEN=your_secret_token
```

#### Railway Cron Example

Use Railway's Cron Jobs feature to schedule HTTP requests to the refresh endpoint.

## How It Works

### Trigger-Based Notification

When analytics events are inserted:
1. A trigger increments an event counter (non-blocking)
2. If threshold (100 events) is exceeded AND last refresh was >5 minutes ago:
   - The trigger sends a PostgreSQL NOTIFY event (never blocks inserts)
3. The worker or cron processes the notification and refreshes views

### Refresh Function

The `check_and_refresh_analytics_views()` function:
- Checks if refresh is needed (event count >= threshold, >5 min since last refresh)
- Refreshes all 7 materialized views concurrently (non-blocking for reads)
- Returns detailed results including per-view status
- Updates the refresh state (timestamp and counter reset)

### Non-Blocking Design

**Critical**: The trigger NEVER performs synchronous refresh. It only:
- Increments a counter (fast)
- Sends a NOTIFY (fast, async)
- Never blocks event inserts

All heavy refresh work is done by the worker/cron, not in the trigger.

## Configuration

### Adjust Refresh Threshold

To change when refreshes occur (default: 100 events):

```sql
UPDATE analytics_refresh_state 
SET refresh_threshold = 200  -- Refresh after 200 events instead of 100
WHERE id = 'single';
```

### Check Current State

```sql
SELECT * FROM analytics_refresh_state;
```

This shows:
- `last_refresh`: When views were last refreshed
- `event_count_since_refresh`: How many events since last refresh
- `refresh_threshold`: Current threshold setting

### Manual Refresh

To manually trigger a refresh:

```sql
SELECT check_and_refresh_analytics_views();
```

Or via API:
```bash
curl -X POST http://localhost:3000/api/analytics/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring

### Worker Logs

The worker logs include:
- Timestamp of each operation
- Refresh status (refreshed/skipped)
- Event counts and thresholds
- Per-view refresh results
- Duration of operations
- Errors (if any)

### KPI Endpoint Freshness

KPI endpoints (`/api/metrics/kpis`, `/api/metrics/conversions`) include freshness metadata:

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "lastRefresh": "2025-01-15T10:30:00Z",
    "dataFreshness": "Refreshed 5 minutes ago"
  }
}
```

### Database Monitoring

Check refresh state:
```sql
SELECT 
  last_refresh,
  event_count_since_refresh,
  refresh_threshold,
  now() - last_refresh as time_since_refresh
FROM analytics_refresh_state
WHERE id = 'single';
```

## Troubleshooting

### Views Not Refreshing

1. **Check if worker is running**:
   ```bash
   # Check if process is running
   ps aux | grep analytics-refresh-worker
   ```

2. **Check worker logs** for errors

3. **Check database state**:
   ```sql
   SELECT * FROM analytics_refresh_state;
   ```

4. **Manually trigger refresh**:
   ```sql
   SELECT check_and_refresh_analytics_views();
   ```

### Worker Not Starting

1. **Check environment variables**:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Check dependencies**:
   ```bash
   pnpm install
   ```

3. **Check TypeScript compilation**:
   ```bash
   pnpm typecheck
   ```

### Views Refreshing Too Often

Increase the threshold:
```sql
UPDATE analytics_refresh_state 
SET refresh_threshold = 500  -- Higher threshold = less frequent refreshes
WHERE id = 'single';
```

### Views Not Refreshing Often Enough

Decrease the threshold:
```sql
UPDATE analytics_refresh_state 
SET refresh_threshold = 50  -- Lower threshold = more frequent refreshes
WHERE id = 'single';
```

## Production Deployment

### Recommended Setup

1. **Use pg_cron** (if available) - most reliable
2. **Or use external cron** (Vercel Cron, Railway Cron) calling the API endpoint
3. **Or run worker as a service** (PM2, systemd, Docker)

### Running as a Service

#### PM2 Example

```bash
pm2 start apps/dealer-dashboard/src/workers/analytics-refresh-worker.ts \
  --name analytics-refresh \
  --interpreter tsx \
  --env production
```

#### systemd Example

Create `/etc/systemd/system/analytics-refresh.service`:

```ini
[Unit]
Description=Analytics Refresh Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/AutoAgent/apps/dealer-dashboard
Environment="NEXT_PUBLIC_SUPABASE_URL=..."
Environment="SUPABASE_SERVICE_ROLE_KEY=..."
ExecStart=/usr/bin/pnpm worker:analytics-refresh
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable analytics-refresh
sudo systemctl start analytics-refresh
```

## API Endpoint

The refresh endpoint is available at `/api/analytics/refresh`:

- **POST**: Requires `Authorization: Bearer TOKEN` header if `ANALYTICS_REFRESH_TOKEN` is set
- **GET**: Manual refresh (no auth required, but should be protected in production)

Response includes refresh results:
```json
{
  "success": true,
  "data": {
    "refreshed": true,
    "event_count": 150,
    "threshold": 100,
    "refreshed_at": "2025-01-15T10:30:00Z",
    "views": [
      {
        "view": "daily_leads_per_dealer",
        "status": "success",
        "refreshed_at": "2025-01-15T10:30:00Z"
      },
      ...
    ]
  }
}
```

## Summary

- **7 materialized views** are automatically refreshed
- **Non-blocking**: Triggers never block inserts
- **Multiple options**: Worker, pg_cron, or external cron
- **Detailed logging**: Per-view refresh status
- **Freshness indicators**: KPI endpoints show last refresh time
- **Configurable**: Adjust thresholds as needed


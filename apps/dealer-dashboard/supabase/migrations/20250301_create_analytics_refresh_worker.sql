-- Phase 4: Background Worker Setup for Analytics Refresh
-- 
-- This migration sets up a pg_cron job to process refresh notifications
-- Alternative: Set up a LISTEN/NOTIFY worker in your application
--
-- Note: pg_cron requires superuser privileges. If pg_cron is not available,
-- set up an application-level worker that LISTENs for 'analytics_refresh_needed' notifications.

-- Enable pg_cron extension (if available and permitted)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a job to check for refresh notifications every 2 minutes
-- The job will call process_analytics_refresh_notification() which checks if refresh is needed
-- SELECT cron.schedule(
--   'analytics-refresh-worker',
--   '*/2 * * * *', -- Every 2 minutes
--   $$SELECT process_analytics_refresh_notification();$$
-- );

-- Alternative: For applications without pg_cron, set up a Node.js worker:
-- 
-- ```typescript
-- import { createClient } from '@supabase/supabase-js';
-- const supabase = createClient(url, key);
-- 
-- // Listen for refresh notifications
-- supabase.channel('analytics-refresh')
--   .on('postgres_changes', {
--     event: 'NOTIFY',
--     schema: 'public',
--     filter: 'channel=analytics_refresh_needed'
--   }, () => {
--     // Call refresh function
--     supabase.rpc('process_analytics_refresh_notification');
--   })
--   .subscribe();
-- ```

-- Manual refresh endpoint (for testing/fallback)
-- POST /api/analytics/refresh can call: SELECT check_and_refresh_analytics_views();


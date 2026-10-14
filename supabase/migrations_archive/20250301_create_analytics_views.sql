-- Phase 4: Analytics Materialized Views
-- Creates materialized views for fast analytics queries with refresh strategy

-- ============================================
-- 1. Daily Leads Per Dealer (Materialized)
-- ============================================
drop materialized view if exists daily_leads_per_dealer;
create materialized view daily_leads_per_dealer as
select
  dealer_id,
  date_trunc('day', timestamp) as date,
  count(*) as lead_count,
  count(distinct session_id) as unique_sessions,
  count(distinct vehicle_id) as unique_vehicles,
  count(distinct vin) as unique_vins
from analytics_events
where event_name = 'lead.submit'
  and dealer_id is not null
group by dealer_id, date_trunc('day', timestamp);

-- Index on materialized view
create index if not exists idx_daily_leads_per_dealer_dealer_date on daily_leads_per_dealer(dealer_id, date desc);

-- ============================================
-- 2. Search to Lead Conversion (Materialized)
-- ============================================
drop materialized view if exists search_to_lead_conversion;
create materialized view search_to_lead_conversion as
with search_events as (
  select
    dealer_id,
    session_id,
    vehicle_id,
    vin,
    timestamp as search_timestamp
  from analytics_events
  where event_name = 'inventory.search'
),
lead_events as (
  select
    dealer_id,
    session_id,
    vehicle_id,
    vin,
    timestamp as lead_timestamp
  from analytics_events
  where event_name = 'lead.submit'
),
conversions as (
  select
    s.dealer_id,
    s.session_id,
    s.vehicle_id,
    s.vin,
    s.search_timestamp,
    min(l.lead_timestamp) as lead_timestamp,
    case when l.vehicle_id is not null then 1 else 0 end as converted
  from search_events s
  left join lead_events l
    on s.session_id = l.session_id
    and (
      s.vehicle_id = l.vehicle_id
      or (s.vin is not null and s.vin = l.vin)
    )
    and l.lead_timestamp > s.search_timestamp
    and l.lead_timestamp <= s.search_timestamp + interval '7 days'
  group by s.dealer_id, s.session_id, s.vehicle_id, s.vin, s.search_timestamp, l.vehicle_id
)
select
  dealer_id,
  count(*) as total_searches,
  sum(converted) as conversions,
  case
    when count(*) > 0 then round((sum(converted)::numeric / count(*)::numeric) * 100, 2)
    else 0
  end as conversion_rate_percent,
  avg(case when converted = 1 then extract(epoch from (lead_timestamp - search_timestamp)) / 3600 else null end) as avg_hours_to_convert
from conversions
where dealer_id is not null
group by dealer_id;

-- Index on materialized view
create index if not exists idx_search_to_lead_conversion_dealer on search_to_lead_conversion(dealer_id);

-- ============================================
-- 3. Inventory Engagement (Materialized)
-- ============================================
drop materialized view if exists inventory_engagement;
create materialized view inventory_engagement as
select
  e.dealer_id,
  e.vehicle_id,
  e.vin,
  count(*) as total_events,
  count(distinct e.session_id) as unique_sessions,
  count(distinct case when e.event_name = 'vehicle.view' then e.session_id end) as view_count,
  count(distinct case when e.event_name = 'vehicle.click' then e.session_id end) as click_count,
  count(distinct case when e.event_name = 'lead.submit' then e.vehicle_id end) as lead_count,
  min(e.timestamp) as first_seen_at,
  max(e.timestamp) as last_seen_at,
  max(e.timestamp) - min(e.timestamp) as engagement_duration
from analytics_events e
where e.vehicle_id is not null
  and e.dealer_id is not null
group by e.dealer_id, e.vehicle_id, e.vin;

-- Index on materialized view
create index if not exists idx_inventory_engagement_dealer_vehicle on inventory_engagement(dealer_id, vehicle_id);

-- ============================================
-- 4. Filter Usage Stats (Materialized)
-- ============================================
drop materialized view if exists filter_usage_stats;
create materialized view filter_usage_stats as
select
  dealer_id,
  date_trunc('day', timestamp) as date,
  payload->>'make' as make_filter,
  payload->>'model' as model_filter,
  payload->>'condition' as condition_filter,
  payload->>'priceMin' as price_min_filter,
  payload->>'priceMax' as price_max_filter,
  payload->>'location' as location_filter,
  count(*) as usage_count,
  count(distinct session_id) as unique_sessions
from analytics_events
where event_name = 'inventory.search'
  and dealer_id is not null
  and payload is not null
group by dealer_id, date_trunc('day', timestamp), payload->>'make', payload->>'model', 
  payload->>'condition', payload->>'priceMin', payload->>'priceMax', payload->>'location';

-- Index on materialized view
create index if not exists idx_filter_usage_stats_dealer_date on filter_usage_stats(dealer_id, date desc);

-- ============================================
-- 5. Last 30 Days Activity (Materialized)
-- ============================================
drop materialized view if exists last_30_days_activity;
create materialized view last_30_days_activity as
select
  dealer_id,
  event_name,
  date_trunc('day', timestamp) as date,
  count(*) as event_count,
  count(distinct session_id) as unique_sessions,
  count(distinct vehicle_id) as unique_vehicles,
  count(distinct user_id) as unique_users
from analytics_events
where timestamp >= now() - interval '30 days'
  and dealer_id is not null
group by dealer_id, event_name, date_trunc('day', timestamp);

-- Index on materialized view
create index if not exists idx_last_30_days_activity_dealer_event_date on last_30_days_activity(dealer_id, event_name, date desc);

-- ============================================
-- 6. Weekly Aggregated Metrics (Materialized)
-- ============================================
drop materialized view if exists weekly_metrics_per_dealer;
create materialized view weekly_metrics_per_dealer as
select
  dealer_id,
  date_trunc('week', timestamp) as week_start,
  count(*) as total_events,
  count(distinct session_id) as unique_sessions,
  count(distinct case when event_name = 'inventory.search' then session_id end) as search_sessions,
  count(distinct case when event_name = 'vehicle.view' then vehicle_id end) as vehicles_viewed,
  count(distinct case when event_name = 'lead.submit' then id end) as leads_submitted,
  count(distinct case when event_name = 'lead.submit' then vehicle_id end) as vehicles_with_leads
from analytics_events
where dealer_id is not null
group by dealer_id, date_trunc('week', timestamp);

-- Index on materialized view
create index if not exists idx_weekly_metrics_per_dealer_dealer_week on weekly_metrics_per_dealer(dealer_id, week_start desc);

-- ============================================
-- 7. Monthly Aggregated Metrics (Materialized)
-- ============================================
drop materialized view if exists monthly_metrics_per_dealer;
create materialized view monthly_metrics_per_dealer as
select
  dealer_id,
  date_trunc('month', timestamp) as month_start,
  count(*) as total_events,
  count(distinct session_id) as unique_sessions,
  count(distinct case when event_name = 'inventory.search' then session_id end) as search_sessions,
  count(distinct case when event_name = 'vehicle.view' then vehicle_id end) as vehicles_viewed,
  count(distinct case when event_name = 'lead.submit' then id end) as leads_submitted,
  count(distinct case when event_name = 'lead.submit' then vehicle_id end) as vehicles_with_leads
from analytics_events
where dealer_id is not null
group by dealer_id, date_trunc('month', timestamp);

-- Index on materialized view
create index if not exists idx_monthly_metrics_per_dealer_dealer_month on monthly_metrics_per_dealer(dealer_id, month_start desc);

-- ============================================
-- 8. Refresh Strategy Functions
-- ============================================

-- Function to refresh all materialized views
create or replace function refresh_analytics_views()
returns void as $$
begin
  refresh materialized view concurrently daily_leads_per_dealer;
  refresh materialized view concurrently search_to_lead_conversion;
  refresh materialized view concurrently inventory_engagement;
  refresh materialized view concurrently filter_usage_stats;
  refresh materialized view concurrently last_30_days_activity;
  refresh materialized view concurrently weekly_metrics_per_dealer;
  refresh materialized view concurrently monthly_metrics_per_dealer;
end;
$$ language plpgsql;

-- Function to refresh a single materialized view
create or replace function refresh_analytics_view(view_name text)
returns void as $$
begin
  case view_name
    when 'daily_leads_per_dealer' then
      refresh materialized view concurrently daily_leads_per_dealer;
    when 'search_to_lead_conversion' then
      refresh materialized view concurrently search_to_lead_conversion;
    when 'inventory_engagement' then
      refresh materialized view concurrently inventory_engagement;
    when 'filter_usage_stats' then
      refresh materialized view concurrently filter_usage_stats;
    when 'last_30_days_activity' then
      refresh materialized view concurrently last_30_days_activity;
    when 'weekly_metrics_per_dealer' then
      refresh materialized view concurrently weekly_metrics_per_dealer;
    when 'monthly_metrics_per_dealer' then
      refresh materialized view concurrently monthly_metrics_per_dealer;
    else
      raise exception 'Unknown materialized view: %', view_name;
  end case;
end;
$$ language plpgsql;

-- ============================================
-- 8. Refresh Strategy
-- ============================================

-- Function to refresh all materialized views (already defined above)
-- This function refreshes views concurrently to avoid blocking

-- ============================================
-- 9. Refresh Strategy Implementation
-- ============================================

-- Option A: Using pg_cron extension (recommended for production)
-- Run this in Supabase SQL Editor AFTER enabling pg_cron extension:
-- 
-- SELECT cron.schedule(
--   'refresh-analytics-views',
--   '*/15 * * * *', -- Every 15 minutes
--   'SELECT refresh_analytics_views();'
-- );
--
-- To enable pg_cron in Supabase:
-- 1. Go to Database > Extensions
-- 2. Enable "pg_cron" extension
-- 3. Run the cron.schedule() command above

-- Option B: Manual refresh (for development/testing)
-- Call this function manually or via API:
-- SELECT refresh_analytics_views();

-- Option C: Trigger-based refresh (alternative)
-- This refreshes views after every N events (can be performance-intensive)
-- Not recommended for high-volume scenarios

-- ============================================
-- 10. Initial Refresh
-- ============================================
-- Refresh all views initially (non-concurrent, can be slow)
-- This runs once when the migration is executed
refresh materialized view daily_leads_per_dealer;
refresh materialized view search_to_lead_conversion;
refresh materialized view inventory_engagement;
refresh materialized view filter_usage_stats;
refresh materialized view last_30_days_activity;
refresh materialized view weekly_metrics_per_dealer;
refresh materialized view monthly_metrics_per_dealer;

-- ============================================
-- 11. Refresh Instructions
-- ============================================
-- 
-- PRODUCTION SETUP:
-- 1. Enable pg_cron extension in Supabase dashboard
-- 2. Run: SELECT cron.schedule('refresh-analytics-views', '*/15 * * * *', 'SELECT refresh_analytics_views();');
-- 
-- DEVELOPMENT:
-- Call refresh manually: SELECT refresh_analytics_views();
-- Or set up a simple cron job outside the database
--
-- VIEW REFRESH FREQUENCY:
-- - High-volume: Every 5-15 minutes
-- - Medium-volume: Every 30-60 minutes  
-- - Low-volume: Every hour or on-demand

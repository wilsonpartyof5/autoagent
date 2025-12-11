-- Phase 4: Materialized View Refresh Trigger
-- Implements automatic refresh of materialized views after events

-- Create refresh state table if it doesn't exist
create table if not exists analytics_refresh_state (
  id text primary key default 'single',
  last_refresh timestamptz not null default now(),
  event_count_since_refresh integer default 0,
  refresh_threshold integer default 100, -- Refresh after 100 events
  constraint single_row check (id = 'single')
);

-- Initialize refresh state
insert into analytics_refresh_state (id, last_refresh, event_count_since_refresh)
values ('single', now(), 0)
on conflict (id) do nothing;

-- Function to check if refresh is needed and perform it
-- This function is called by the worker/cron, not by triggers
create or replace function check_and_refresh_analytics_views()
returns jsonb as $$
declare
  event_count integer;
  threshold integer;
  last_refresh_time timestamptz;
  refresh_result jsonb := '{}'::jsonb;
  view_name text;
  view_results jsonb := '[]'::jsonb;
  view_result jsonb;
begin
  -- Get current state
  select event_count_since_refresh, refresh_threshold, last_refresh
  into event_count, threshold, last_refresh_time
  from analytics_refresh_state
  where id = 'single';
  
  -- Refresh if threshold exceeded and last refresh was more than 5 minutes ago
  if event_count >= threshold and 
     now() - last_refresh_time > interval '5 minutes' then
    -- Use the centralized refresh function for consistency
    -- Refresh all views with error handling and logging
    for view_name in 
      select unnest(array[
        'daily_leads_per_dealer',
        'search_to_lead_conversion',
        'inventory_engagement',
        'filter_usage_stats',
        'last_30_days_activity',
        'weekly_metrics_per_dealer',
        'monthly_metrics_per_dealer'
      ])
    loop
      begin
        perform refresh_analytics_view(view_name);
        view_result := jsonb_build_object(
          'view', view_name,
          'status', 'success',
          'refreshed_at', now()
        );
      exception when others then
        view_result := jsonb_build_object(
          'view', view_name,
          'status', 'error',
          'error', sqlerrm,
          'refreshed_at', now()
        );
        raise warning 'Failed to refresh %: %', view_name, sqlerrm;
      end;
      view_results := view_results || jsonb_build_array(view_result);
    end loop;
    
    -- Reset counter and update timestamp
    update analytics_refresh_state 
    set last_refresh = now(), event_count_since_refresh = 0
    where id = 'single';
    
    refresh_result := jsonb_build_object(
      'refreshed', true,
      'event_count', event_count,
      'threshold', threshold,
      'last_refresh_before', last_refresh_time,
      'refreshed_at', now(),
      'views', view_results
    );
  else
    refresh_result := jsonb_build_object(
      'refreshed', false,
      'reason', 'threshold not met or too soon since last refresh',
      'event_count', event_count,
      'threshold', threshold,
      'last_refresh', last_refresh_time,
      'minutes_since_refresh', extract(epoch from (now() - last_refresh_time)) / 60
    );
  end if;
  
  return refresh_result;
end;
$$ language plpgsql;

-- Function to increment event counter and trigger refresh (with debouncing)
-- NEVER performs synchronous refresh - only NOTIFYs to avoid blocking inserts
create or replace function increment_analytics_refresh_counter()
returns trigger as $$
declare
  current_count integer;
  threshold_val integer;
  last_refresh_val timestamptz;
begin
  -- Increment counter (fast, non-blocking)
  update analytics_refresh_state
  set event_count_since_refresh = event_count_since_refresh + 1
  where id = 'single'
  returning event_count_since_refresh, refresh_threshold, last_refresh
  into current_count, threshold_val, last_refresh_val;
  
  -- Check if refresh needed (fast check)
  -- Refresh if threshold exceeded and last refresh was more than 5 minutes ago
  if current_count >= threshold_val and 
     now() - last_refresh_val > interval '5 minutes' then
    -- Always NOTIFY - never perform synchronous refresh in trigger
    -- This ensures inserts are never blocked by heavy refresh operations
    perform pg_notify('analytics_refresh_needed', json_build_object(
      'event_count', current_count,
      'threshold', threshold_val,
      'timestamp', now()
    )::text);
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Create trigger to increment counter after event insert
drop trigger if exists trigger_increment_analytics_refresh_counter on analytics_events;
create trigger trigger_increment_analytics_refresh_counter
  after insert on analytics_events
  for each row
  execute function increment_analytics_refresh_counter();

-- Grant necessary permissions
grant execute on function check_and_refresh_analytics_views() to authenticated;
grant execute on function increment_analytics_refresh_counter() to authenticated;


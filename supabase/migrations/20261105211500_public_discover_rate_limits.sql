-- Durable counters for anonymous Discover search/detail.
-- Service role only. Anon and authenticated have no table or RPC access.
-- NOT applied by this PR. Do not run against production from the Discover change.

create table if not exists public.public_discover_rate_limits (
  bucket text primary key check (char_length(bucket) between 8 and 180),
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.public_discover_rate_limits is
  'Anonymous Discover IP/global windows. No shopper identity. Service role only.';

alter table public.public_discover_rate_limits enable row level security;
alter table public.public_discover_rate_limits force row level security;

revoke all on table public.public_discover_rate_limits from public, anon, authenticated;
grant select, insert, update on table public.public_discover_rate_limits to service_role;

create or replace function public.touch_public_discover_rate_limit(
  p_bucket text,
  p_window_start timestamptz,
  p_limit integer
)
returns table(
  allowed boolean,
  hit_count integer,
  window_start timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window timestamptz;
begin
  if p_bucket is null or char_length(p_bucket) < 8 or char_length(p_bucket) > 180 then
    raise exception 'invalid rate limit bucket';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit';
  end if;
  if p_window_start is null then
    raise exception 'window start is required';
  end if;

  insert into public.public_discover_rate_limits as rl (bucket, window_start, hit_count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket) do update
  set
    hit_count = case
      when rl.window_start = excluded.window_start then rl.hit_count + 1
      else 1
    end,
    window_start = excluded.window_start,
    updated_at = timezone('utc'::text, now())
  returning rl.hit_count, rl.window_start
  into v_count, v_window;

  return query select (v_count <= p_limit), v_count, v_window;
end;
$$;

revoke execute on function public.touch_public_discover_rate_limit(text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.touch_public_discover_rate_limit(text, timestamptz, integer)
  to service_role;

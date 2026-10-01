-- Shopper identity for the consumer app.
-- Email and phone stay in auth.users. This table stores no contact fields.
-- Apple sign-ins are shoppers, so they do not receive a dealer profile row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_app_meta_data->>'provider' = 'apple' then
    return new;
  end if;

  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create table if not exists public.consumer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.consumer_profile_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'disabled')),
  occurred_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_consumer_profile_status_events_user_time
  on public.consumer_profile_status_events (user_id, occurred_at desc);

alter table public.consumer_profiles enable row level security;
alter table public.consumer_profile_status_events enable row level security;

drop policy if exists "Consumers read own profile" on public.consumer_profiles;
create policy "Consumers read own profile"
  on public.consumer_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.consumer_profiles to authenticated;
revoke insert, update, delete on public.consumer_profiles from anon, authenticated;
revoke all on public.consumer_profile_status_events from anon, authenticated;

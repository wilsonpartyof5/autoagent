-- FCM device tokens for shopper push (APNs through FCM).
-- A token belongs to one shopper. Registering it again moves it.
--
-- NOT APPLIED. Do not run this against production from the push change.

create table if not exists public.device_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null check (char_length(token) between 20 and 4096),
  platform text not null default 'ios' check (platform = 'ios'),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, token),
  constraint device_tokens_token_key unique (token)
);

create index if not exists device_tokens_user
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "Shoppers read own device tokens" on public.device_tokens;
create policy "Shoppers read own device tokens"
  on public.device_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Shoppers insert own device tokens" on public.device_tokens;
create policy "Shoppers insert own device tokens"
  on public.device_tokens
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Shoppers update own device tokens" on public.device_tokens;
create policy "Shoppers update own device tokens"
  on public.device_tokens
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Shoppers delete own device tokens" on public.device_tokens;
create policy "Shoppers delete own device tokens"
  on public.device_tokens
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.device_tokens from public, anon;
grant select, insert, update, delete on public.device_tokens to authenticated;
grant select, insert, update, delete on public.device_tokens to service_role;

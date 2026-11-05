-- NOT APPLIED. Draft only. Do not run this against production, a preview
-- branch, or any hosted database from the activation-adapter change.
-- This file does not insert auth users, user_dealerships rows, or dealerships.
-- A demo desk cookie is not a row in this table.

create table if not exists public.dealer_onboarding_commitments (
  user_id uuid not null references auth.users(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  terms_version text not null,
  commitments text[] not null,
  recorded_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, dealership_id),
  constraint dealer_onboarding_commitments_required
    check (commitments @> array['message-only', 'itemized-otd']::text[])
);

comment on table public.dealer_onboarding_commitments is
  'Recorded message-only and itemized-best-OTD commitments for an authenticated member of this rooftop. Not a demo cookie and not a legal acceptance captured by this draft.';

alter table public.dealer_onboarding_commitments enable row level security;
alter table public.dealer_onboarding_commitments force row level security;

revoke all on public.dealer_onboarding_commitments from public, anon, authenticated;
grant select on public.dealer_onboarding_commitments to authenticated;
grant select, insert, update, delete on public.dealer_onboarding_commitments to service_role;

drop policy if exists "Members read own onboarding commitments" on public.dealer_onboarding_commitments;
create policy "Members read own onboarding commitments"
  on public.dealer_onboarding_commitments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

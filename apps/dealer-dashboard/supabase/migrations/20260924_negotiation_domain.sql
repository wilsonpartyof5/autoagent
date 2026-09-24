-- Phase 3 negotiation domain.
-- A case is not a lead. This migration does not touch leads or ADF delivery.
-- Message threads, offers, and approvals arrive in later phases.
-- related_message_id and related_offer_id are reserved ids with no foreign key yet.

create table if not exists public.negotiation_policies (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  rules jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  check (effective_to is null or effective_to > effective_from)
);

create table if not exists public.shopper_aliases (
  id uuid primary key default gen_random_uuid(),
  consumer_user_id uuid not null unique references auth.users(id) on delete cascade,
  public_code text not null unique check (public_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$'),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.negotiation_cases (
  id uuid primary key default gen_random_uuid(),
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  shopper_alias_id uuid not null references public.shopper_aliases(id),
  listing_id text not null references public.uvs_vehicles(id),
  vin text,
  dealership_id uuid not null references public.dealerships(id),
  policy_id uuid not null references public.negotiation_policies(id),
  policy_version integer not null,
  agent_model_version text,
  market_context_id uuid,
  state text not null check (state in (
    'draft',
    'mandate_approved',
    'ready_for_dealer',
    'dealer_contacted',
    'awaiting_dealer',
    'awaiting_shopper',
    'offer_in_review',
    'agreed',
    'closed_won',
    'closed_lost',
    'expired'
  )),
  outcome text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  check (
    (state in ('closed_won', 'closed_lost', 'expired') and outcome = state)
    or (state not in ('closed_won', 'closed_lost', 'expired') and outcome is null)
  )
);

create unique index if not exists negotiation_cases_one_open_listing
  on public.negotiation_cases (consumer_user_id, listing_id)
  where state not in ('closed_won', 'closed_lost', 'expired');

create index if not exists idx_negotiation_cases_consumer_created
  on public.negotiation_cases (consumer_user_id, created_at desc);

create index if not exists idx_negotiation_cases_dealership_state
  on public.negotiation_cases (dealership_id, state);

create index if not exists idx_negotiation_cases_listing
  on public.negotiation_cases (listing_id);

create table if not exists public.vehicle_market_contexts (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references public.uvs_vehicles(id),
  negotiation_case_id uuid references public.negotiation_cases(id) on delete cascade,
  asking_price numeric,
  days_on_market integer,
  price_change_count integer not null default 0 check (price_change_count >= 0),
  local_comp_count integer not null default 0 check (local_comp_count >= 0),
  local_median numeric,
  price_vs_median numeric,
  mileage_vs_median numeric,
  market_position text not null check (market_position in ('below_market', 'at_market', 'above_market', 'unknown')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  feature_version text not null,
  generated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.negotiation_cases
  add constraint negotiation_cases_market_context_id_fkey
  foreign key (market_context_id) references public.vehicle_market_contexts(id);

create index if not exists idx_vehicle_market_contexts_listing_time
  on public.vehicle_market_contexts (listing_id, generated_at desc);

create index if not exists idx_vehicle_market_contexts_case
  on public.vehicle_market_contexts (negotiation_case_id);

create table if not exists public.shopper_mandates (
  id uuid primary key default gen_random_uuid(),
  negotiation_case_id uuid not null references public.negotiation_cases(id) on delete cascade,
  version integer not null check (version > 0),
  timing text,
  max_price numeric check (max_price is null or max_price >= 0),
  max_otd numeric check (max_otd is null or max_otd >= 0),
  payment_preference text,
  down_payment numeric check (down_payment is null or down_payment >= 0),
  financing_preference text,
  trade_in text,
  must_haves text[] not null default '{}',
  deal_breakers text[] not null default '{}',
  add_on_tolerance text,
  questions text[] not null default '{}',
  travel text,
  buy_now_readiness text,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (negotiation_case_id, version)
);

create index if not exists idx_shopper_mandates_case_version
  on public.shopper_mandates (negotiation_case_id, version desc);

create table if not exists public.negotiation_state_events (
  id uuid primary key default gen_random_uuid(),
  negotiation_case_id uuid not null references public.negotiation_cases(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  from_state text,
  to_state text not null,
  actor text not null check (actor in ('shopper', 'dealer', 'agent', 'system')),
  reason text,
  policy_version integer not null,
  related_message_id uuid,
  related_offer_id uuid,
  occurred_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_negotiation_state_events_case_time
  on public.negotiation_state_events (negotiation_case_id, occurred_at desc);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  negotiation_case_id uuid not null references public.negotiation_cases(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  idempotency_key text not null,
  policy_id uuid references public.negotiation_policies(id),
  policy_version integer not null,
  agent_model_version text,
  market_context_id uuid references public.vehicle_market_contexts(id),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (consumer_user_id, tool_name, idempotency_key)
);

create index if not exists idx_agent_actions_case_time
  on public.agent_actions (negotiation_case_id, created_at desc);

create index if not exists idx_negotiation_cases_alias
  on public.negotiation_cases (shopper_alias_id);

create index if not exists idx_negotiation_cases_policy
  on public.negotiation_cases (policy_id);

create index if not exists idx_negotiation_cases_market_context
  on public.negotiation_cases (market_context_id);

create or replace function private.reject_negotiation_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'negotiation history is append-only';
end;
$$;

create or replace function private.protect_negotiation_case_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.consumer_user_id is distinct from old.consumer_user_id
     or new.shopper_alias_id is distinct from old.shopper_alias_id
     or new.listing_id is distinct from old.listing_id
     or new.vin is distinct from old.vin
     or new.dealership_id is distinct from old.dealership_id
     or new.policy_id is distinct from old.policy_id
     or new.policy_version is distinct from old.policy_version
     or new.created_at is distinct from old.created_at
  then
    raise exception 'negotiation case identity is immutable';
  end if;
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function private.reject_negotiation_history_mutation() from public, anon, authenticated;
revoke all on function private.protect_negotiation_case_identity() from public, anon, authenticated;

drop trigger if exists negotiation_cases_protect_identity on public.negotiation_cases;
create trigger negotiation_cases_protect_identity
  before update on public.negotiation_cases
  for each row execute function private.protect_negotiation_case_identity();

drop trigger if exists shopper_mandates_append_only on public.shopper_mandates;
create trigger shopper_mandates_append_only
  before update or delete on public.shopper_mandates
  for each row execute function private.reject_negotiation_history_mutation();

drop trigger if exists vehicle_market_contexts_append_only on public.vehicle_market_contexts;
create trigger vehicle_market_contexts_append_only
  before update or delete on public.vehicle_market_contexts
  for each row execute function private.reject_negotiation_history_mutation();

drop trigger if exists negotiation_state_events_append_only on public.negotiation_state_events;
create trigger negotiation_state_events_append_only
  before update or delete on public.negotiation_state_events
  for each row execute function private.reject_negotiation_history_mutation();

drop trigger if exists agent_actions_append_only on public.agent_actions;
create trigger agent_actions_append_only
  before update or delete on public.agent_actions
  for each row execute function private.reject_negotiation_history_mutation();

drop trigger if exists negotiation_policies_append_only on public.negotiation_policies;
create trigger negotiation_policies_append_only
  before update or delete on public.negotiation_policies
  for each row execute function private.reject_negotiation_history_mutation();

insert into public.negotiation_policies (version, effective_from, rules)
values (
  1,
  timezone('utc'::text, now()),
  $policy${"autonomousActions":["create_negotiation_case","save_shopper_mandate","approve_shopper_mandate","update_negotiation_state","build_vehicle_market_context"],"approvalGates":["accept_deal","place_deposit","submit_credit_application","share_contact_information","agree_outside_mandate"],"piiDenyList":["email","phone","address","full_name"],"allowedTransitions":[{"from":"draft","to":"mandate_approved"},{"from":"draft","to":"closed_lost"},{"from":"draft","to":"expired"},{"from":"mandate_approved","to":"draft"},{"from":"mandate_approved","to":"ready_for_dealer"},{"from":"mandate_approved","to":"closed_lost"},{"from":"mandate_approved","to":"expired"},{"from":"ready_for_dealer","to":"draft"},{"from":"ready_for_dealer","to":"dealer_contacted"},{"from":"ready_for_dealer","to":"closed_lost"},{"from":"ready_for_dealer","to":"expired"},{"from":"dealer_contacted","to":"draft"},{"from":"dealer_contacted","to":"awaiting_dealer"},{"from":"dealer_contacted","to":"awaiting_shopper"},{"from":"dealer_contacted","to":"closed_lost"},{"from":"dealer_contacted","to":"expired"},{"from":"awaiting_dealer","to":"draft"},{"from":"awaiting_dealer","to":"offer_in_review"},{"from":"awaiting_dealer","to":"awaiting_shopper"},{"from":"awaiting_dealer","to":"closed_lost"},{"from":"awaiting_dealer","to":"expired"},{"from":"awaiting_shopper","to":"draft"},{"from":"awaiting_shopper","to":"awaiting_dealer"},{"from":"awaiting_shopper","to":"agreed"},{"from":"awaiting_shopper","to":"closed_lost"},{"from":"awaiting_shopper","to":"expired"},{"from":"offer_in_review","to":"draft"},{"from":"offer_in_review","to":"awaiting_dealer"},{"from":"offer_in_review","to":"awaiting_shopper"},{"from":"offer_in_review","to":"agreed"},{"from":"offer_in_review","to":"closed_lost"},{"from":"offer_in_review","to":"expired"},{"from":"agreed","to":"draft"},{"from":"agreed","to":"closed_won"},{"from":"agreed","to":"closed_lost"},{"from":"agreed","to":"expired"}]}$policy$::jsonb
)
on conflict (version) do nothing;

alter table public.negotiation_policies enable row level security;
alter table public.shopper_aliases enable row level security;
alter table public.negotiation_cases enable row level security;
alter table public.vehicle_market_contexts enable row level security;
alter table public.shopper_mandates enable row level security;
alter table public.negotiation_state_events enable row level security;
alter table public.agent_actions enable row level security;

drop policy if exists "Shoppers read own alias" on public.shopper_aliases;
create policy "Shoppers read own alias"
  on public.shopper_aliases for select to authenticated
  using ((select auth.uid()) = consumer_user_id);

drop policy if exists "Shoppers read own negotiation cases" on public.negotiation_cases;
create policy "Shoppers read own negotiation cases"
  on public.negotiation_cases for select to authenticated
  using ((select auth.uid()) = consumer_user_id);

drop policy if exists "Shoppers read own mandates" on public.shopper_mandates;
create policy "Shoppers read own mandates"
  on public.shopper_mandates for select to authenticated
  using (
    exists (
      select 1 from public.negotiation_cases c
      where c.id = negotiation_case_id
        and c.consumer_user_id = (select auth.uid())
    )
  );

drop policy if exists "Shoppers read own market context" on public.vehicle_market_contexts;
create policy "Shoppers read own market context"
  on public.vehicle_market_contexts for select to authenticated
  using (
    exists (
      select 1 from public.negotiation_cases c
      where c.id = negotiation_case_id
        and c.consumer_user_id = (select auth.uid())
    )
  );

drop policy if exists "Shoppers read own state events" on public.negotiation_state_events;
create policy "Shoppers read own state events"
  on public.negotiation_state_events for select to authenticated
  using ((select auth.uid()) = consumer_user_id);

drop policy if exists "Shoppers read own agent actions" on public.agent_actions;
create policy "Shoppers read own agent actions"
  on public.agent_actions for select to authenticated
  using ((select auth.uid()) = consumer_user_id);

drop policy if exists "Authenticated read negotiation policies" on public.negotiation_policies;
create policy "Authenticated read negotiation policies"
  on public.negotiation_policies for select to authenticated
  using (true);

revoke all on public.negotiation_policies from anon;
revoke insert, update, delete on public.negotiation_policies from authenticated;
grant select on public.negotiation_policies to authenticated;

revoke all on public.shopper_aliases from anon;
revoke insert, update, delete on public.shopper_aliases from authenticated;
grant select on public.shopper_aliases to authenticated;

revoke all on public.negotiation_cases from anon;
revoke insert, update, delete on public.negotiation_cases from authenticated;
grant select on public.negotiation_cases to authenticated;

revoke all on public.vehicle_market_contexts from anon;
revoke insert, update, delete on public.vehicle_market_contexts from authenticated;
grant select on public.vehicle_market_contexts to authenticated;

revoke all on public.shopper_mandates from anon;
revoke insert, update, delete on public.shopper_mandates from authenticated;
grant select on public.shopper_mandates to authenticated;

revoke all on public.negotiation_state_events from anon;
revoke insert, update, delete on public.negotiation_state_events from authenticated;
grant select on public.negotiation_state_events to authenticated;

revoke all on public.agent_actions from anon;
revoke insert, update, delete on public.agent_actions from authenticated;
grant select on public.agent_actions to authenticated;

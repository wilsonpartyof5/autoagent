-- SEC-22. Forward migration only. This file is not applied to any database
-- by the pull request. Prod already has public.drevvy_vdp_matches (analytics
-- drevvy_keys_network_otd; the draft SQL is not in this repo). CREATE TABLE
-- IF NOT EXISTS does not rewrite that table. It mirrors the prod columns for
-- a database that does not have it yet.
--
-- Requires, only when the table is missing: public.dealerships,
-- public.drevvy_dealers, and private.drevvy_uuidv7(). Prod has all three,
-- so this create does not rewrite them and does not replace those objects.
--
-- network_status is GENERATED ALWAYS (stored):
--   dealership_id is null -> off_network, otherwise in_network.
-- The backend always writes dealership_id for an in-network rooftop, so the
-- generated value is in_network. Do not insert or update the column
-- (SQLSTATE 428C9).

create table if not exists public.drevvy_vdp_matches (
  id uuid primary key default private.drevvy_uuidv7(),
  listing_id text not null,
  url_hash text not null,
  url_domain text,
  match_method text not null,
  dealership_id uuid,
  drevvy_dealer_id uuid,
  network_status text generated always as (
    case
      when (dealership_id is null) then 'off_network'::text
      else 'in_network'::text
    end
  ) stored,
  matcher_version text not null,
  matched_at timestamptz not null default timezone('utc'::text, now()),
  constraint drevvy_vdp_matches_match_method_check
    check (match_method = any (array['exact_url'::text, 'domain'::text, 'dealer_map'::text, 'none'::text])),
  constraint drevvy_vdp_matches_dealership_id_fkey
    foreign key (dealership_id) references public.dealerships (id),
  constraint drevvy_vdp_matches_drevvy_dealer_id_fkey
    foreign key (drevvy_dealer_id) references public.drevvy_dealers (id)
);

create index if not exists drevvy_vdp_matches_listing
  on public.drevvy_vdp_matches using btree (listing_id, matched_at desc);

alter table public.drevvy_vdp_matches enable row level security;

-- Deliberately NOT "force row level security": private.drevvy_conversation_key_guard()
-- and private.drevvy_conversation_settle() are SECURITY DEFINER owned by postgres (table owner)
-- and must keep reading this table. Forcing RLS with no policy would make the guard reject every conversation spend.

revoke all on public.drevvy_vdp_matches from public, anon, authenticated;

grant select, insert, update on public.drevvy_vdp_matches to service_role; -- backend writer (createAdminClient)

-- Optional tighten to match the original draft intent (service_role currently has arwdDxtm):
-- revoke delete, truncate, references, trigger on public.drevvy_vdp_matches from service_role;

comment on table public.drevvy_vdp_matches is
  'Internal: VDP->rooftop match. Server-only (service_role). RLS on, no client policies by design.';

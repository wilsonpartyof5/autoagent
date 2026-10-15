-- Platform bills for the admin costs page.
-- NOT APPLIED. Do not run this from the costs-page change. Apply it on purpose
-- before the admin console can save a bill.
-- Operator data only. The service role is the only client. Shopper routes must
-- not read this table.

create table if not exists public.platform_bills (
  id bigint generated always as identity primary key,
  service text not null,
  billed_month date not null,
  amount_usd numeric(12, 2) not null,
  note text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint platform_bills_service_text check (
    char_length(btrim(service)) between 1 and 80
    and service = btrim(service)
  ),
  constraint platform_bills_month_start check (extract(day from billed_month) = 1),
  constraint platform_bills_amount check (amount_usd >= 0 and amount_usd <= 1000000),
  constraint platform_bills_note_length check (char_length(note) <= 500)
);

comment on table public.platform_bills is
  'Operator-entered platform bills (service, month, dollars, note) for the admin costs page.';

create index if not exists platform_bills_billed_month_idx
  on public.platform_bills (billed_month desc);

alter table public.platform_bills enable row level security;
alter table public.platform_bills force row level security;

revoke all on table public.platform_bills from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_bills to service_role;

revoke all on sequence public.platform_bills_id_seq from public, anon, authenticated;
grant usage, select on sequence public.platform_bills_id_seq to service_role;

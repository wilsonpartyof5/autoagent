-- In-network dealer desk thread. Message-only. Do not reuse shopper_outreach_messages
-- and do not wire Telnyx. Desk reads/writes through the service role after a
-- user_dealerships membership check.

create table if not exists public.shopper_dealer_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.shopper_dealer_conversations(deal_id) on delete cascade,
  author text not null check (author in ('drevvy', 'shopper', 'salesperson')),
  kind text not null default 'chat' check (kind in ('chat', 'opener', 'numbers')),
  body text not null check (char_length(body) between 1 and 2000),
  sent_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.shopper_dealer_messages is
  'In-app dealer desk thread. First row is the in-network opener. Not outreach. Not Telnyx.';

create index if not exists shopper_dealer_messages_deal_sent_idx
  on public.shopper_dealer_messages (deal_id, sent_at);

alter table public.shopper_dealer_messages enable row level security;
alter table public.shopper_dealer_messages force row level security;

revoke all on public.shopper_dealer_messages from public, anon, authenticated;
grant select, insert, update, delete on public.shopper_dealer_messages to service_role;

alter table public.shopper_dealer_conversations
  add column if not exists first_reply_at timestamptz,
  add column if not exists stated_price_cents integer
    check (stated_price_cents is null or stated_price_cents >= 100),
  add column if not exists written_otd_cents integer
    check (written_otd_cents is null or written_otd_cents >= 100),
  add column if not exists dealer_marked_sold_at timestamptz;

comment on column public.shopper_dealer_conversations.first_reply_at is
  'First salesperson reply on the in-app thread. Desk analytics median first-reply uses this.';

comment on column public.shopper_dealer_conversations.stated_price_cents is
  'Informational price the salesperson typed into Share numbers. Not a binding offer.';

comment on column public.shopper_dealer_conversations.written_otd_cents is
  'Informational written out-the-door total shared in chat. Not a binding offer.';

comment on column public.shopper_dealer_conversations.dealer_marked_sold_at is
  'Desk mark-sold. Does not write dealer_close_fees; the shopper confirm-purchase path owns the $300.';

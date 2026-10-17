-- Raised when a live send is held because no text number is free.
-- The admin outreach page shows the purchase flag while this is true,
-- including when cooldown leaves the pool empty for a dealer.
-- ADDITIVE ONLY. Applies on merge. Service role only.

alter table public.identity_settings
  add column if not exists purchase_needed boolean not null default false;

comment on column public.identity_settings.purchase_needed is
  'True when a live send was held because no text number was free. Cleared when a live pool number is added. A number in cooldown is not reused.';

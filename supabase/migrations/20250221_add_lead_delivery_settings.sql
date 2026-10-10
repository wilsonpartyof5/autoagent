-- Add lead delivery settings to profiles table
-- Supports HTTP endpoint or email delivery methods

alter table profiles
  add column if not exists lead_delivery_method text check (lead_delivery_method in ('http', 'email') or lead_delivery_method is null),
  add column if not exists lead_delivery_endpoint text,
  add column if not exists lead_delivery_email text;

-- Add index for faster lookups
create index if not exists idx_profiles_lead_delivery_method 
  on profiles(lead_delivery_method) 
  where lead_delivery_method is not null;

-- Add comment for documentation
comment on column profiles.lead_delivery_method is 'Method for delivering leads: http (POST to endpoint) or email (send XML attachment)';
comment on column profiles.lead_delivery_endpoint is 'HTTP endpoint URL for lead delivery (required when method is http)';
comment on column profiles.lead_delivery_email is 'Email address for lead delivery (required when method is email)';


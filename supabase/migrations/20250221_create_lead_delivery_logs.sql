-- Create lead_delivery_logs table to track delivery attempts and enable resend

create table if not exists lead_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  dealer_id text,
  
  -- Delivery configuration used
  delivery_method text not null check (delivery_method in ('http', 'email')),
  delivery_target text not null, -- endpoint URL or email address
  
  -- Delivery attempt details
  status text not null check (status in ('pending', 'success', 'failed')),
  http_status integer, -- HTTP status code if method is http
  response_body text, -- Response body (truncated to 1000 chars)
  error_message text, -- Error message if failed
  
  -- ADF payload storage for resend capability
  adf_payload xml not null,
  
  -- Metadata
  attempted_at timestamptz not null default timezone('utc'::text, now()),
  attempted_by text default 'system', -- 'system' for auto, user_id for manual resend
  resend_note text, -- Note when manually resent
  
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Indexes for common queries
create index if not exists idx_lead_delivery_logs_lead_id on lead_delivery_logs(lead_id);
create index if not exists idx_lead_delivery_logs_user_id on lead_delivery_logs(user_id);
create index if not exists idx_lead_delivery_logs_dealer_id on lead_delivery_logs(dealer_id);
create index if not exists idx_lead_delivery_logs_status on lead_delivery_logs(status);
create index if not exists idx_lead_delivery_logs_attempted_at on lead_delivery_logs(attempted_at desc);

-- RLS policies
alter table lead_delivery_logs enable row level security;

-- Users can view their own delivery logs
create policy "Users can view own delivery logs"
  on lead_delivery_logs for select
  using (auth.uid() = user_id);

-- Users can insert their own delivery logs (for resend)
create policy "Users can insert own delivery logs"
  on lead_delivery_logs for insert
  with check (auth.uid() = user_id);

-- Add comment
comment on table lead_delivery_logs is 'Tracks ADF XML lead delivery attempts for HTTP endpoints and email. Enables resend functionality.';


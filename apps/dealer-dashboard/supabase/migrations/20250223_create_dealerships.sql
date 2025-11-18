-- Create dealerships table for multi-store support
-- Each dealership represents a physical location/store

create table if not exists dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  logo_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Create junction table for user-dealership relationships
create table if not exists user_dealerships (
  user_id uuid references auth.users(id) on delete cascade,
  dealership_id uuid references dealerships(id) on delete cascade,
  role text default 'owner',
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, dealership_id)
);

-- Create user preferences table for storing active dealership
create table if not exists user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  active_dealership_id uuid references dealerships(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Create indexes
create index if not exists idx_user_dealerships_user_id on user_dealerships(user_id);
create index if not exists idx_user_dealerships_dealership_id on user_dealerships(dealership_id);
create index if not exists idx_dealerships_marketcheck_dealer_id on dealerships(marketcheck_dealer_id);
create index if not exists idx_user_preferences_user_id on user_preferences(user_id);
create index if not exists idx_user_preferences_active_dealership_id on user_preferences(active_dealership_id);

-- Enable RLS
alter table dealerships enable row level security;
alter table user_dealerships enable row level security;
alter table user_preferences enable row level security;

-- RLS Policies for dealerships
-- Users can view dealerships they are members of
drop policy if exists "Users can view their dealerships" on dealerships;
create policy "Users can view their dealerships"
  on dealerships for select
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = dealerships.id
        and user_dealerships.user_id = auth.uid()
    )
  );

-- Users can update dealerships they own
drop policy if exists "Users can update their dealerships" on dealerships;
create policy "Users can update their dealerships"
  on dealerships for update
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = dealerships.id
        and user_dealerships.user_id = auth.uid()
        and user_dealerships.role = 'owner'
    )
  );

-- Users can insert dealerships (will be linked via user_dealerships)
drop policy if exists "Users can insert dealerships" on dealerships;
create policy "Users can insert dealerships"
  on dealerships for insert
  with check (true); -- Allow insert, but user_dealerships will enforce access

-- RLS Policies for user_dealerships
-- Users can view their own memberships
drop policy if exists "Users can view their memberships" on user_dealerships;
create policy "Users can view their memberships"
  on user_dealerships for select
  using (auth.uid() = user_id);

-- Users can insert their own memberships (with restrictions handled in application logic)
drop policy if exists "Users can insert their memberships" on user_dealerships;
create policy "Users can insert their memberships"
  on user_dealerships for insert
  with check (auth.uid() = user_id);

-- RLS Policies for user_preferences
-- Users can view their own preferences
drop policy if exists "Users can view their preferences" on user_preferences;
create policy "Users can view their preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

-- Users can update their own preferences
drop policy if exists "Users can update their preferences" on user_preferences;
create policy "Users can update their preferences"
  on user_preferences for update
  using (auth.uid() = user_id);

-- Users can insert their own preferences
drop policy if exists "Users can insert their preferences" on user_preferences;
create policy "Users can insert their preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);


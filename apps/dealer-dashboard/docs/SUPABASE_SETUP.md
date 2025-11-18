# Supabase Configuration Guide

## 1. Redirect Origins Configuration

Before testing authentication, you **must** configure redirect origins in your Supabase dashboard:

### Steps:
1. Log into your Supabase dashboard at https://supabase.com/dashboard
2. Select your project: `vqoawedqmeybbndvqxta`
3. Navigate to: **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   - `http://localhost:3000`
   - `http://localhost:3000/auth`
   - `http://localhost:3000/app/setup`
5. (For production) Add your production domain:
   - `https://your-domain.com`
   - `https://your-domain.com/auth`
   - `https://your-domain.com/app/setup`

### Why This Matters:
Without these redirect URLs configured, Supabase will block authentication redirects and you'll see errors like:
- "Invalid redirect_to URL"
- "The redirect URL has not been whitelisted"

---

## 2. Profiles Table Setup (Optional but Recommended)

Create the onboarding tables used by the dashboard. Run the SQL migrations located under
`apps/dealer-dashboard/supabase/migrations/` in this order:

1. `20250219_add_profiles_table.sql`
2. `20250220_alter_profiles_marketcheck.sql`
3. `20250220_create_inventory_vehicles.sql`

### Profiles Table Snapshot
```sql
create table if not exists profiles (
  id uuid references auth.users(id) primary key,
  email text,
  onboarding_completed boolean default false,
  inventory_connected boolean default false,
  billing_active boolean default false,
  dms_provider text,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table profiles enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

### Inventory Table Snapshot

```sql
create table if not exists inventory_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  vin text,
  stock_number text,
  listing_id text,
  year integer,
  make text,
  model text,
  trim text,
  condition text,
  body_type text,
  drivetrain text,
  fuel_type text,
  transmission text,
  price numeric,
  msrp numeric,
  price_change_history jsonb,
  miles numeric,
  dealer_name text,
  dealer_city text,
  dealer_state text,
  dealer_lat numeric,
  dealer_lng numeric,
  dealer_phone text,
  dealer_website text,
  dealer_id text,
  dealer_address text,
  photo_urls text[],
  thumbnail_url text,
  primary_photo_url text,
  video_url text,
  features text[],
  interior_color text,
  exterior_color text,
  certified boolean default false,
  market_average_price numeric,
  days_on_market integer,
  source text,
  last_synced_at timestamptz,
  sync_status text default 'pending',
  data_source text default 'marketcheck-api',
  lead_status text default 'none',
  last_lead_at timestamptz,
  lead_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  raw jsonb
);

create index if not exists idx_inventory_vehicles_user_id on inventory_vehicles(user_id);
create index if not exists idx_inventory_vehicles_vin on inventory_vehicles(vin);
create index if not exists idx_inventory_vehicles_listing_id on inventory_vehicles(listing_id);
create index if not exists idx_inventory_vehicles_stock_number on inventory_vehicles(stock_number);
```

### Usage Example
Once created, you can query profiles in `/app/setup`:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('inventory_connected, billing_active, dms_provider, marketcheck_dealer_id, marketcheck_zip')
  .eq('id', user.id)
  .single();

const { data: vehicles } = await supabase
  .from('inventory_vehicles')
  .select('vin, year, make, model, trim, price, miles, condition, market_average_price, photo_urls')
  .eq('user_id', user.id);
```

---

## 3. Environment Variables

Make sure your `.env.local` includes:
```
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Note:** The `NEXT_PUBLIC_` prefix is required for client-side access in Next.js.

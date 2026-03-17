# Vercel Demo Account Setup Guide

This guide walks you through setting up a live demo account for the AutoAgent dealer dashboard on Vercel.

**Dashboard URL**: https://autoagent-dealer-dashboard.vercel.app

## ⚠️ IMPORTANT: Production Write Guard

**All demo/seed scripts in this directory contain production write guards.**

These scripts create demo data and should **NEVER** run against production databases. They will automatically block writes to production-like Supabase URLs (containing "prod", "production", "vercel", "live").

**Recommendation**: Use a separate Supabase project or local instance for demo/testing.

To override the guard (not recommended):
```bash
ALLOW_PROD_WRITE=true node scripts/setup-vercel-demo.js
```

## Prerequisites

- Access to Supabase Dashboard (project: `vqoawedqmeybbndvqxta`)
- Supabase service role key (for automated setup)
- Rock Hill GMC vehicles already in `inventory_vehicles` table
- **Use a non-production Supabase project for demo setup**

## Option 1: Automated Setup (Recommended)

### Step 1: Install Dependencies

```bash
cd /Users/mac/AutoAgent
pnpm install
```

### Step 2: Configure Environment Variables

Ensure `apps/dealer-dashboard/.env.local` has:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get the service role key from: Supabase Dashboard → Settings → API → service_role key

### Step 3: Run Setup Script

```bash
node scripts/setup-vercel-demo.js
```

This script will:
- ✅ Create demo user (`demo@autoagent.com` / `Demo123!@#`)
- ✅ Create/update profile with onboarding flags
- ✅ Create or find Rock Hill GMC dealership
- ✅ Link user to dealership
- ✅ Set active dealership preference
- ✅ Attach Rock Hill vehicles to dealership
- ✅ Mark vehicles as live/published

### Step 4: Verify

1. Go to https://autoagent-dealer-dashboard.vercel.app/auth
2. Log in with:
   - Email: `demo@autoagent.com`
   - Password: `Demo123!@#`
3. You should see the dashboard (not onboarding)
4. Navigate to `/app/inventory` to see the 10 Rock Hill GMC vehicles

**Note**: The login page is at `/auth`, not `/app/login`

## Option 2: Manual SQL Setup

### Step 1: Create User Manually

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter:
   - Email: `demo@autoagent.com`
   - Password: `Demo123!@#`
   - Auto-confirm email: ✅

### Step 2: Run SQL Script

1. Go to Supabase Dashboard → SQL Editor
2. Open `scripts/setup-vercel-demo-sql-only.sql`
3. Copy and paste into SQL Editor
4. Run the script

### Step 3: Verify

Same as Option 1, Step 4.

## Verification Queries

Run these in Supabase SQL Editor to verify setup:

```sql
-- Check demo user
SELECT id, email, onboarding_completed, inventory_connected, billing_active
FROM profiles
WHERE email = 'demo@autoagent.com';

-- Check dealership
SELECT id, name, marketcheck_dealer_id, marketcheck_zip
FROM dealerships
WHERE name ILIKE '%Rock Hill%';

-- Check user-dealership link
SELECT ud.user_id, ud.dealership_id, ud.role, d.name
FROM user_dealerships ud
JOIN dealerships d ON d.id = ud.dealership_id
JOIN profiles p ON p.id = ud.user_id
WHERE p.email = 'demo@autoagent.com';

-- Check active dealership
SELECT up.user_id, up.active_dealership_id, d.name
FROM user_preferences up
JOIN dealerships d ON d.id = up.active_dealership_id
JOIN profiles p ON p.id = up.user_id
WHERE p.email = 'demo@autoagent.com';

-- Check vehicles
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(*) FILTER (WHERE is_live = true) as live_vehicles,
  COUNT(*) FILTER (WHERE published_at IS NOT NULL) as published_vehicles
FROM inventory_vehicles
WHERE dealership_id IN (
  SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%'
);

-- List vehicles
SELECT 
  id,
  year,
  make,
  model,
  trim,
  condition,
  price,
  is_live,
  published_at
FROM inventory_vehicles
WHERE dealership_id IN (
  SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%'
)
ORDER BY year DESC, make, model
LIMIT 10;
```

## Troubleshooting

### No vehicles found

If the script reports "No Rock Hill vehicles found":

1. **Check if vehicles exist**:
   ```sql
   SELECT COUNT(*) FROM inventory_vehicles
   WHERE dealer_name ILIKE '%Rock Hill%' OR dealer_id = '11042155';
   ```

2. **If no vehicles exist**, you need to:
   - Run MarketCheck sync for dealer 11042155, OR
   - Seed demo inventory using `scripts/seed-demo-inventory.sql`

3. **If vehicles exist but aren't linked**, the script should update them automatically. If not, run:
   ```sql
   UPDATE inventory_vehicles
   SET dealership_id = (
     SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%' LIMIT 1
   ),
   is_live = true,
   published_at = NOW()
   WHERE dealer_name ILIKE '%Rock Hill%' OR dealer_id = '11042155';
   ```

### User can't log in

1. **Check redirect URLs** in Supabase Dashboard → Authentication → URL Configuration:
   - `https://autoagent-dealer-dashboard.vercel.app`
   - `https://autoagent-dealer-dashboard.vercel.app/auth`
   - `https://autoagent-dealer-dashboard.vercel.app/app/setup`

2. **Verify user exists**:
   ```sql
   SELECT id, email, email_confirmed_at
   FROM auth.users
   WHERE email = 'demo@autoagent.com';
   ```

3. **Reset password if needed** (Supabase Dashboard → Authentication → Users → Reset Password)

### Dashboard shows onboarding

If the dashboard redirects to `/app/setup`:

1. **Check profile flags**:
   ```sql
   SELECT onboarding_completed, inventory_connected, billing_active
   FROM profiles
   WHERE email = 'demo@autoagent.com';
   ```

2. **Update if needed**:
   ```sql
   UPDATE profiles
   SET onboarding_completed = true,
       inventory_connected = true,
       billing_active = true
   WHERE email = 'demo@autoagent.com';
   ```

## Demo Credentials Summary

- **Email**: `demo@autoagent.com`
- **Password**: `Demo123!@#`
- **Dashboard**: https://autoagent-dealer-dashboard.vercel.app/app/login
- **Dealership**: Rock Hill GMC
- **Expected Vehicles**: 10 (Rock Hill GMC inventory)

## Next Steps (Optional Polish)

1. **Add demo lead**: Create a test lead in `leads` table
2. **Feature a vehicle**: Set `is_live = true` and ensure it has `primary_photo_url`
3. **Update marketing copy**: Change any "Main Street Dealership" references to "Rock Hill GMC Demo"


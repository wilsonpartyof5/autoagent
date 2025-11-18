# Vercel Demo Account Setup - Complete Guide

**Dashboard URL**: https://autoagent-dealer-dashboard.vercel.app  
**Login URL**: https://autoagent-dealer-dashboard.vercel.app/auth

This document provides complete instructions for setting up a live demo account with Rock Hill GMC inventory.

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# 1. Ensure environment variables are set
cd /Users/mac/AutoAgent
# Edit apps/dealer-dashboard/.env.local to include:
# NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 2. Run setup script
node scripts/setup-vercel-demo.js

# 3. Verify setup
node scripts/verify-vercel-demo.js
```

### Option 2: Manual SQL Setup

1. Create user in Supabase Dashboard → Authentication → Add User
   - Email: `demo@autoagent.com`
   - Password: `Demo123!@#`
   - Auto-confirm: ✅

2. Run SQL script in Supabase SQL Editor:
   - Open `scripts/setup-vercel-demo-sql-only.sql`
   - Copy and paste into SQL Editor
   - Execute

3. Verify in dashboard:
   - Go to https://autoagent-dealer-dashboard.vercel.app/auth
   - Log in with demo credentials

## Demo Credentials

- **Email**: `demo@autoagent.com`
- **Password**: `Demo123!@#`
- **Dealership**: Rock Hill GMC
- **MarketCheck Dealer ID**: `11042155`
- **ZIP**: `29730`

## What Gets Set Up

### 1. User Account
- Created in `auth.users` table
- Email confirmed automatically
- Password: `Demo123!@#`

### 2. Profile (`profiles` table)
- `onboarding_completed`: `true`
- `inventory_connected`: `true`
- `billing_active`: `true` (for polished demo)
- `dms_provider`: `marketcheck`
- `marketcheck_dealer_id`: `11042155`
- `marketcheck_zip`: `29730`

### 3. Dealership (`dealerships` table)
- Name: `Rock Hill GMC`
- MarketCheck Dealer ID: `11042155`
- ZIP: `29730`

### 4. User-Dealership Link (`user_dealerships` table)
- User linked to Rock Hill GMC dealership
- Role: `owner`

### 5. Active Dealership Preference (`user_preferences` table)
- Active dealership set to Rock Hill GMC

### 6. Vehicle Inventory (`inventory_vehicles` table)
- All Rock Hill GMC vehicles linked to dealership
- `dealership_id` set to Rock Hill GMC
- `is_live` set to `true`
- `published_at` set to current timestamp
- `published_by` set to demo user ID

## Files Created

1. **`scripts/setup-vercel-demo.js`** - Automated setup script (Node.js)
2. **`scripts/setup-vercel-demo-sql-only.sql`** - SQL-only setup script
3. **`scripts/setup-vercel-demo-account.sql`** - Original comprehensive SQL script
4. **`scripts/verify-vercel-demo.js`** - Verification script
5. **`scripts/README_VERCEL_DEMO_SETUP.md`** - Detailed setup guide

## Verification Checklist

After running setup, verify:

- [ ] User can log in at https://autoagent-dealer-dashboard.vercel.app/auth
- [ ] Dashboard loads (not redirected to onboarding)
- [ ] `/app/inventory` shows 10 Rock Hill GMC vehicles
- [ ] Vehicles are marked as live (`is_live = true`)
- [ ] Dealership name shows "Rock Hill GMC" in header/store switcher
- [ ] Profile shows `inventory_connected = true` and `billing_active = true`

## SQL Verification Queries

Run these in Supabase SQL Editor to verify:

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

### No Vehicles Found

If verification shows 0 vehicles:

1. **Check if Rock Hill vehicles exist**:
   ```sql
   SELECT COUNT(*) FROM inventory_vehicles
   WHERE dealer_name ILIKE '%Rock Hill%' OR dealer_id = '11042155';
   ```

2. **If vehicles exist but aren't linked**, run:
   ```sql
   UPDATE inventory_vehicles
   SET dealership_id = (
     SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%' LIMIT 1
   ),
   is_live = true,
   published_at = NOW()
   WHERE (dealer_name ILIKE '%Rock Hill%' OR dealer_id = '11042155')
     AND dealership_id IS NULL;
   ```

3. **If no vehicles exist**, you need to:
   - Run MarketCheck sync for dealer 11042155, OR
   - Seed demo inventory (see `scripts/seed-demo-inventory.sql` - update dealer_id to 11042155)

### Redirect URLs

Ensure Supabase redirect URLs are configured:
- Supabase Dashboard → Authentication → URL Configuration
- Add:
  - `https://autoagent-dealer-dashboard.vercel.app`
  - `https://autoagent-dealer-dashboard.vercel.app/auth`
  - `https://autoagent-dealer-dashboard.vercel.app/app/setup`

### Dashboard Shows Onboarding

If dashboard redirects to `/app/setup`:

```sql
UPDATE profiles
SET onboarding_completed = true,
    inventory_connected = true,
    billing_active = true
WHERE email = 'demo@autoagent.com';
```

## Optional Enhancements

### Add Demo Lead

```sql
-- Get demo user ID
SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo@autoagent.com';

-- Get a vehicle ID
SELECT id INTO vehicle_id FROM inventory_vehicles 
WHERE dealership_id = (SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%' LIMIT 1)
LIMIT 1;

-- Insert demo lead (if leads table exists)
INSERT INTO leads (
  user_id,
  vehicle_id,
  customer_name,
  customer_email,
  customer_phone,
  status,
  created_at
)
VALUES (
  demo_user_id,
  vehicle_id,
  'John Demo',
  'demo@example.com',
  '555-0100',
  'new',
  NOW()
);
```

### Feature a Vehicle

```sql
-- Set a vehicle as featured (ensure it has photos)
UPDATE inventory_vehicles
SET 
  is_live = true,
  published_at = NOW(),
  primary_photo_url = COALESCE(primary_photo_url, thumbnail_url, photo_urls[1])
WHERE dealership_id = (SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%' LIMIT 1)
  AND id = (
    SELECT id FROM inventory_vehicles 
    WHERE dealership_id = (SELECT id FROM dealerships WHERE name ILIKE '%Rock Hill%' LIMIT 1)
    AND primary_photo_url IS NOT NULL
    LIMIT 1
  );
```

## Next Steps

1. ✅ Run setup script
2. ✅ Verify login works
3. ✅ Confirm 10 vehicles visible
4. ⏳ (Optional) Add demo lead
5. ⏳ (Optional) Feature a vehicle
6. ⏳ (Optional) Update marketing copy to "Rock Hill GMC Demo"

## Support

For issues:
1. Check `scripts/README_VERCEL_DEMO_SETUP.md` for detailed troubleshooting
2. Run `node scripts/verify-vercel-demo.js` to diagnose issues
3. Check Supabase logs for errors


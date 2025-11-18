-- ============================================================================
-- AutoAgent Vercel Demo Account Setup (SQL-Only Version)
-- ============================================================================
-- Use this if you prefer to create the user manually via Supabase Dashboard
-- and then run this SQL script to complete the setup.
--
-- Steps:
-- 1. Create user manually: Supabase Dashboard → Authentication → Add User
--    - Email: demo@autoagent.com
--    - Password: Demo123!@#
-- 2. Run this script to complete the setup
-- ============================================================================

-- Step 1: Get demo user ID (replace if different email)
DO $$
DECLARE
  demo_user_id uuid;
  demo_email text := 'demo@autoagent.com';
  rock_hill_dealership_id uuid;
  vehicle_count int;
BEGIN
  -- Find demo user
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = demo_email;

  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found. Please create user first: Supabase Dashboard → Authentication → Add User (Email: %, Password: Demo123!@#)', demo_email;
  END IF;

  RAISE NOTICE '✅ Found demo user: % (ID: %)', demo_email, demo_user_id;

  -- Step 2: Create/update profile
  INSERT INTO profiles (
    id,
    email,
    onboarding_completed,
    inventory_connected,
    billing_active,
    dms_provider,
    marketcheck_dealer_id,
    marketcheck_zip,
    updated_at
  )
  VALUES (
    demo_user_id,
    demo_email,
    true,  -- onboarding_completed
    true,  -- inventory_connected
    true,  -- billing_active (for polished demo)
    'marketcheck',
    '11042155',  -- Rock Hill GMC MarketCheck dealer ID
    '29730',     -- Rock Hill, SC ZIP
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    onboarding_completed = EXCLUDED.onboarding_completed,
    inventory_connected = EXCLUDED.inventory_connected,
    billing_active = EXCLUDED.billing_active,
    dms_provider = EXCLUDED.dms_provider,
    marketcheck_dealer_id = EXCLUDED.marketcheck_dealer_id,
    marketcheck_zip = EXCLUDED.marketcheck_zip,
    updated_at = NOW();

  RAISE NOTICE '✅ Profile created/updated';

  -- Step 3: Find or create Rock Hill GMC dealership
  SELECT id INTO rock_hill_dealership_id
  FROM dealerships
  WHERE name ILIKE '%Rock Hill%GMC%'
     OR (marketcheck_dealer_id = '11042155' AND marketcheck_zip = '29730')
  LIMIT 1;

  IF rock_hill_dealership_id IS NULL THEN
    INSERT INTO dealerships (
      name,
      marketcheck_dealer_id,
      marketcheck_zip,
      created_at,
      updated_at
    )
    VALUES (
      'Rock Hill GMC',
      '11042155',
      '29730',
      NOW(),
      NOW()
    )
    RETURNING id INTO rock_hill_dealership_id;

    RAISE NOTICE '✅ Created Rock Hill GMC dealership (ID: %)', rock_hill_dealership_id;
  ELSE
    RAISE NOTICE '✅ Found existing Rock Hill GMC dealership (ID: %)', rock_hill_dealership_id;
  END IF;

  -- Step 4: Link user to dealership
  INSERT INTO user_dealerships (
    user_id,
    dealership_id,
    role,
    created_at
  )
  VALUES (
    demo_user_id,
    rock_hill_dealership_id,
    'owner',
    NOW()
  )
  ON CONFLICT (user_id, dealership_id) DO NOTHING;

  RAISE NOTICE '✅ Linked user to dealership';

  -- Step 5: Set active dealership preference
  INSERT INTO user_preferences (
    user_id,
    active_dealership_id,
    created_at,
    updated_at
  )
  VALUES (
    demo_user_id,
    rock_hill_dealership_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    active_dealership_id = EXCLUDED.active_dealership_id,
    updated_at = NOW();

  RAISE NOTICE '✅ Set active dealership preference';

  -- Step 6: Find Rock Hill vehicles and attach to dealership
  SELECT COUNT(*) INTO vehicle_count
  FROM inventory_vehicles
  WHERE (dealer_name ILIKE '%Rock Hill%' OR dealer_id = '11042155')
    AND (dealership_id IS NULL OR dealership_id != rock_hill_dealership_id);

  IF vehicle_count > 0 THEN
    UPDATE inventory_vehicles
    SET
      dealership_id = rock_hill_dealership_id,
      is_live = true,
      published_at = COALESCE(published_at, NOW()),
      published_by = demo_user_id,
      updated_at = NOW()
    WHERE (dealer_name ILIKE '%Rock Hill%' OR dealer_id = '11042155')
      AND (dealership_id IS NULL OR dealership_id != rock_hill_dealership_id);

    RAISE NOTICE '✅ Updated % vehicles to Rock Hill dealership', vehicle_count;
  END IF;

  -- Also update vehicles that already have the dealership_id but aren't live
  UPDATE inventory_vehicles
  SET
    is_live = true,
    published_at = COALESCE(published_at, NOW()),
    published_by = demo_user_id,
    updated_at = NOW()
  WHERE dealership_id = rock_hill_dealership_id
    AND (is_live IS NULL OR is_live = false);

  -- Step 7: Verify setup
  SELECT COUNT(*) INTO vehicle_count
  FROM inventory_vehicles
  WHERE dealership_id = rock_hill_dealership_id
    AND is_live = true;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Demo Account Setup Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email: %', demo_email;
  RAISE NOTICE 'Password: Demo123!@#';
  RAISE NOTICE 'Dealership: Rock Hill GMC (ID: %)', rock_hill_dealership_id;
  RAISE NOTICE 'Live Vehicles: %', vehicle_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Login at: https://autoagent-dealer-dashboard.vercel.app/auth';
  RAISE NOTICE '========================================';

END $$;

-- Verification queries (run separately)
/*
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
*/


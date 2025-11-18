-- Rock Hill GMC Onboarding SQL
-- Run this in Supabase SQL Editor after signing in at http://localhost:3000/auth

-- Step 1: Get your user_id (run this first to see your user ID)
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 2: Update profile with Rock Hill GMC settings
-- Replace 'YOUR_USER_ID_HERE' with your actual user_id from Step 1
UPDATE profiles
SET 
  marketcheck_dealer_id = '11042155',
  marketcheck_zip = '29730',
  dms_provider = 'marketcheck',
  updated_at = NOW()
WHERE id = 'YOUR_USER_ID_HERE';

-- Step 3: Verify profile was updated
SELECT 
  id,
  marketcheck_dealer_id,
  marketcheck_zip,
  dms_provider,
  inventory_connected,
  updated_at
FROM profiles
WHERE id = 'YOUR_USER_ID_HERE';

-- Step 4: After running sync, verify inventory was imported
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(*) FILTER (WHERE data_source = 'marketcheck-api') as marketcheck_vehicles,
  COUNT(*) FILTER (WHERE dealer_id = '11042155') as rock_hill_vehicles,
  COUNT(DISTINCT make) as makes,
  COUNT(DISTINCT condition) as conditions,
  MIN(year) as min_year,
  MAX(year) as max_year
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID_HERE';

-- Step 5: Sample vehicles imported
SELECT 
  vin,
  year,
  make,
  model,
  condition,
  price,
  miles,
  dealer_id,
  data_source,
  created_at
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND dealer_id = '11042155'
  AND data_source = 'marketcheck-api'
ORDER BY created_at DESC
LIMIT 10;


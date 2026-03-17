-- Seed Demo Inventory for ChatGPT App Integration Testing
-- ⚠️  PRODUCTION WRITE GUARD
-- This script writes DEMO DATA and should NOT run against production databases.
-- Verify you are connected to a non-production Supabase project before running.
--
-- Run this in Supabase SQL Editor
-- Replace YOUR_USER_ID with your actual user_id from auth.users (check profiles table)

-- Step 1: Get your user_id (run this first to find it)
-- SELECT id, email FROM auth.users LIMIT 1;
-- Or: SELECT id, email FROM profiles LIMIT 1;

-- Step 2: Update profile with MarketCheck dealer settings
-- Replace YOUR_USER_ID below with the ID from Step 1
INSERT INTO profiles (id, marketcheck_dealer_id, marketcheck_zip, dms_provider, updated_at)
VALUES (
  'YOUR_USER_ID',  -- Replace with your user_id
  '10015450',
  '77375',
  'marketcheck',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  marketcheck_dealer_id = EXCLUDED.marketcheck_dealer_id,
  marketcheck_zip = EXCLUDED.marketcheck_zip,
  dms_provider = EXCLUDED.dms_provider,
  updated_at = NOW();

-- Step 3: Clean up existing seed-demo vehicles (optional)
DELETE FROM inventory_vehicles 
WHERE user_id = 'YOUR_USER_ID' AND data_source = 'seed-demo';

-- Step 4: Insert 10 demo vehicles
-- Replace YOUR_USER_ID in all VALUES below
INSERT INTO inventory_vehicles (
  user_id, vin, year, make, model, trim, condition, body_type, price, msrp, miles,
  stock_number, dealer_name, dealer_city, dealer_state, dealer_zip, dealer_id,
  dealer_address, dealer_phone, exterior_color, interior_color, drivetrain,
  fuel_type, transmission, certified, data_source, sync_status, lead_status,
  created_at, updated_at, last_synced_at
) VALUES
('YOUR_USER_ID', '1HGBH41JXMN109186', 2022, 'Toyota', 'Camry', 'LE', 'used', 'Sedan', 28500, 32000, 15000, 'STK-001', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Midnight Black', 'Charcoal', 'FWD', 'Gasoline', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '5YJSA1E26HF123456', 2023, 'Tesla', 'Model 3', 'Long Range', 'new', 'Sedan', 48990, 48990, 5, 'STK-002', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Pearl White', 'Black', 'AWD', 'Electric', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '1C4RJFBG3FC123789', 2021, 'Jeep', 'Grand Cherokee', 'Limited', 'used', 'SUV', 38900, 45000, 28000, 'STK-003', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Granite Crystal', 'Black', '4WD', 'Gasoline', 'Automatic', true, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '1FT8W2BT7TED28933', 2024, 'Ford', 'F-150', 'XLT', 'new', 'Pickup', 45900, 45900, 0, 'STK-004', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Oxford White', 'Ebony', '4WD', 'Gasoline', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', 'WBA3A5C58EF123456', 2020, 'BMW', 'X5', 'xDrive40i', 'used', 'SUV', 42900, 61000, 35000, 'STK-005', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Mineral White', 'Black Vernasca Leather', 'AWD', 'Gasoline', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '5TDDKRFH8LS123456', 2023, 'Honda', 'CR-V', 'EX-L', 'new', 'SUV', 32900, 32900, 10, 'STK-006', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Radiant Red', 'Black', 'FWD', 'Gasoline', 'CVT', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '1G1BE5SM8K7123456', 2019, 'Chevrolet', 'Corvette', 'Stingray', 'used', 'Coupe', 59900, 59995, 12000, 'STK-007', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Arctic White', 'Jet Black', 'RWD', 'Gasoline', 'Manual', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', 'JTMB1RFV8KD123456', 2023, 'Toyota', 'RAV4', 'XLE Premium', 'new', 'SUV', 36900, 36900, 8, 'STK-008', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Lunar Rock', 'Softex Black', 'AWD', 'Hybrid', 'CVT', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '1FA6P8TH5L5123456', 2020, 'Ford', 'Mustang', 'GT Premium', 'used', 'Coupe', 38900, 45000, 18000, 'STK-009', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Velocity Blue', 'Ebony', 'RWD', 'Gasoline', 'Manual', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('YOUR_USER_ID', '5YJ3E1EB5KF123456', 2019, 'Tesla', 'Model Y', 'Long Range', 'used', 'SUV', 42900, 52000, 25000, 'STK-010', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Midnight Silver Metallic', 'Black', 'AWD', 'Electric', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW());

-- Step 5: Verify insertion
SELECT COUNT(*) as vehicle_count, 
       COUNT(DISTINCT condition) as conditions,
       COUNT(DISTINCT body_type) as body_styles
FROM inventory_vehicles 
WHERE user_id = 'YOUR_USER_ID' AND data_source = 'seed-demo';

-- Expected result: 10 vehicles, 2 conditions (new/used), 4 body styles (Sedan/SUV/Pickup/Coupe)


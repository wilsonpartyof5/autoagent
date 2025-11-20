-- Seed Demo Leads for Rock Hill GMC
-- Run this in Supabase SQL Editor after running the migration
-- 
-- This script:
-- 1. Creates demo leads with encrypted payloads (base64 encoded JSON for simplicity)
-- 2. Creates delivery logs for some leads
--
-- Note: For production, use scripts/seed-demo-leads.js which uses proper libsodium encryption

-- Step 1: Get demo user ID and dealership ID
DO $$
DECLARE
  demo_user_id uuid;
  rock_hill_dealership_id uuid;
  rock_hill_dealer_id text := '11042155';
  vehicle_ids uuid[];
  lead_ids text[];
  i int;
  vehicle_id uuid;
  lead_id text;
  created_at_date timestamptz;
  days_ago int;
BEGIN
  -- Get demo user
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'demo@autoagent.com'
  LIMIT 1;

  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user demo@autoagent.com not found. Run setup-vercel-demo.js first.';
  END IF;

  -- Get Rock Hill GMC dealership
  SELECT id INTO rock_hill_dealership_id
  FROM dealerships
  WHERE marketcheck_dealer_id = rock_hill_dealer_id
  LIMIT 1;

  IF rock_hill_dealership_id IS NULL THEN
    RAISE EXCEPTION 'Rock Hill GMC dealership not found. Run setup-vercel-demo.js first.';
  END IF;

  -- Get vehicle IDs
  SELECT ARRAY_AGG(id) INTO vehicle_ids
  FROM inventory_vehicles
  WHERE dealer_id = rock_hill_dealer_id
  LIMIT 15;

  IF vehicle_ids IS NULL OR array_length(vehicle_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No vehicles found for Rock Hill GMC. Run MarketCheck sync first.';
  END IF;

  -- Step 2: Delete existing demo leads
  DELETE FROM leads
  WHERE user_id = demo_user_id
    AND dealer_id = rock_hill_dealer_id;

  -- Step 3: Create demo leads
  -- Note: enc_payload is base64 encoded JSON (simplified for SQL seeding)
  -- For proper encryption, use scripts/seed-demo-leads.js
  FOR i IN 1..LEAST(15, array_length(vehicle_ids, 1)) LOOP
    vehicle_id := vehicle_ids[i];
    lead_id := 'lead_' || encode(gen_random_bytes(12), 'base64');
    
    -- Spread created_at over last 30 days
    days_ago := floor(random() * 30);
    created_at_date := NOW() - (days_ago || ' days')::interval;
    
    -- Create base64 encoded payload (simplified - use JS script for proper encryption)
    INSERT INTO leads (
      id,
      dealer_id,
      vehicle_id,
      vin,
      enc_payload,
      consent,
      user_id,
      created_at
    )
    SELECT
      lead_id,
      rock_hill_dealer_id,
      vehicle_id,
      v.vin,
      encode(
        convert_to(
          json_build_object(
            'user', json_build_object(
              'name', (ARRAY['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Williams', 'Jessica Brown', 'Robert Taylor', 'Amanda Martinez', 'Christopher Lee', 'Michelle Garcia', 'James Anderson', 'Lisa Thompson', 'Daniel White', 'Jennifer Harris', 'Matthew Clark'])[i],
              'email', (ARRAY['john.smith@email.com', 'sarah.j@email.com', 'mchen@email.com', 'emily.r@email.com', 'dwilliams@email.com', 'jessica.b@email.com', 'rtaylor@email.com', 'amanda.m@email.com', 'clee@email.com', 'mgarcia@email.com', 'janderson@email.com', 'lthompson@email.com', 'dwhite@email.com', 'jharris@email.com', 'mclark@email.com'])[i],
              'phone', (ARRAY['(704) 555-0123', '(704) 555-0124', '(704) 555-0125', '(704) 555-0126', '(704) 555-0127', '(704) 555-0128', '(704) 555-0129', '(704) 555-0130', '(704) 555-0131', '(704) 555-0132', '(704) 555-0133', '(704) 555-0134', '(704) 555-0135', '(704) 555-0136', '(704) 555-0137'])[i],
              'preferredTime', (ARRAY['Weekend mornings', 'Weekday afternoons', 'Evenings', 'Any time', 'Weekend afternoons', 'Weekday mornings', 'Weekdays', 'Weekend mornings', 'Business hours', 'Weekend afternoons', 'Weekend mornings', 'Weekdays', 'Any time', 'Weekend afternoons', 'Weekday mornings'])[i]
            ),
            'vehicleId', vehicle_id::text,
            'dealerId', rock_hill_dealer_id,
            'vin', v.vin
          )::text,
          'UTF8'
        ),
        'base64'
      ),
      true,
      demo_user_id,
      created_at_date
    FROM inventory_vehicles v
    WHERE v.id = vehicle_id;

    lead_ids := array_append(lead_ids, lead_id);
  END LOOP;

  -- Step 4: Create delivery logs for some leads
  FOR i IN 1..LEAST(10, array_length(lead_ids, 1)) LOOP
    lead_id := lead_ids[i];
    
    INSERT INTO lead_delivery_logs (
      lead_id,
      user_id,
      dealer_id,
      delivery_method,
      delivery_target,
      status,
      http_status,
      error_message,
      adf_payload,
      attempted_at
    )
    VALUES (
      lead_id,
      demo_user_id,
      rock_hill_dealer_id,
      (ARRAY['http', 'email'])[floor(random() * 2) + 1],
      CASE 
        WHEN floor(random() * 2) = 0 THEN 'https://example.com/crm/endpoint'
        ELSE 'crm@example.com'
      END,
      (ARRAY['success', 'success', 'success', 'failed', 'pending'])[floor(random() * 5) + 1],
      CASE 
        WHEN floor(random() * 3) = 0 THEN 200
        WHEN floor(random() * 3) = 1 THEN 500
        ELSE NULL
      END,
      CASE 
        WHEN floor(random() * 5) = 0 THEN 'Connection timeout'
        ELSE NULL
      END,
      '<?xml version="1.0"?><adf><prospect><customer><contact><name part="full">Demo Lead</name></contact></customer></prospect></adf>',
      (SELECT created_at FROM leads WHERE id = lead_id)
    );
  END LOOP;

  RAISE NOTICE '✅ Created % demo leads', array_length(lead_ids, 1);
  RAISE NOTICE '✅ Created delivery logs for % leads', LEAST(10, array_length(lead_ids, 1));
END $$;

-- Verify leads were created
SELECT 
  COUNT(*) as total_leads,
  COUNT(DISTINCT vehicle_id) as vehicles_with_leads,
  MIN(created_at) as oldest_lead,
  MAX(created_at) as newest_lead
FROM leads
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@autoagent.com' LIMIT 1)
  AND dealer_id = '11042155';


-- Verify signup trigger is minimal and audit its behavior
-- This migration adds documentation and verification checks for the
-- on_auth_user_created trigger to ensure it only creates a profiles row
-- and does NOT create dealership memberships or preferences.
--
-- Date: 2025-02-23

-- Verification query 1: Check that trigger function only touches profiles table
-- Run this to verify the trigger implementation:
/*
SELECT 
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user' AND n.nspname = 'public';
*/

-- Expected result: Function should ONLY insert into profiles table
-- with id and email fields. No user_dealerships or user_preferences inserts.

-- Verification query 2: Check for any other triggers on auth.users
-- Run this to ensure no unexpected triggers exist:
/*
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE t.tgrelid = 'auth.users'::regclass
  AND t.tgisinternal = false
ORDER BY t.tgname;
*/

-- Document expected trigger behavior for ops/audit
-- The on_auth_user_created trigger should ONLY:
-- 1. Insert (id, email) into profiles table
-- 2. No other table modifications
-- 3. No dealership/membership creation

-- Add a comment to the trigger for clarity
comment on trigger on_auth_user_created on auth.users is 
  'Creates minimal profile row on user signup. Does NOT create dealerships or memberships. 
   All tenant linking should happen through app onboarding flow with admin client.';

comment on function public.handle_new_user() is
  'Trigger function that creates a minimal profile row (id, email) when a new user signs up. 
   This function MUST NOT create dealership memberships or preferences to prevent cross-tenant data leakage.';

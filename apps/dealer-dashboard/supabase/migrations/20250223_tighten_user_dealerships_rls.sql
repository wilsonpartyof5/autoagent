-- Tighten user_dealerships RLS to prevent client-side membership creation
-- This migration removes the permissive self-insert policy and restricts
-- membership creation to server-side/admin paths only.
--
-- Context: Prevents new users from inheriting or self-linking to demo dealerships
-- by blocking direct client-side inserts into user_dealerships.
--
-- Date: 2025-02-23

-- Drop the permissive insert policy that allows users to insert their own memberships
drop policy if exists "Users can insert their memberships" on user_dealerships;

-- Create a restrictive policy: only service role (admin) can insert memberships
-- This forces all membership creation through server-side createDealership() path
drop policy if exists "Service role can insert memberships" on user_dealerships;
create policy "Service role can insert memberships"
  on user_dealerships for insert
  with check (
    -- Only allow service role to insert
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Verify: Authenticated clients should NOT be able to insert directly
-- Server actions using createAdminClient() will still work via service role

-- Note: This does not affect existing memberships or read/select operations

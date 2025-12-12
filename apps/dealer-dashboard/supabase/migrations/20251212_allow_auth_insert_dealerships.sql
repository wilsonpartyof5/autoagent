-- Allow authenticated users to create their own dealership records.
-- This policy is intentionally broad for inserts to unblock onboarding.

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;

-- Insert policy for authenticated role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dealerships'
      AND policyname = 'Allow authenticated insert into dealerships'
  ) THEN
    CREATE POLICY "Allow authenticated insert into dealerships"
      ON public.dealerships
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;

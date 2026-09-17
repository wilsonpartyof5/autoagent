-- Add the profile state required by the three-step dealer onboarding flow.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists onboarding_step integer not null default 1
    check (onboarding_step between 1 and 3),
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists billing_skipped_at timestamptz;

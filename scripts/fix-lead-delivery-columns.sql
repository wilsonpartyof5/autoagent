-- Fix: Add missing lead delivery columns to profiles table
-- Run this in Supabase SQL Editor if you get "column profiles.lead_delivery_method does not exist" error

alter table profiles
  add column if not exists lead_delivery_method text,
  add column if not exists lead_delivery_endpoint text,
  add column if not exists lead_delivery_email text;

-- Verify columns were added
select 
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public' 
  and table_name = 'profiles'
  and column_name in ('lead_delivery_method', 'lead_delivery_endpoint', 'lead_delivery_email')
order by column_name;


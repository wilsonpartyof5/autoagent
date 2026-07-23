-- Leads are inserted only by the authenticated dashboard ingest endpoint using
-- the Supabase service role. Remove the historical public INSERT policy.
drop policy if exists "System can insert leads" on public.leads;
revoke insert on public.leads from public, anon, authenticated;

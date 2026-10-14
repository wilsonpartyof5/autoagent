-- Ensure anon role cannot call create_own_dealership function.
-- The function was created in lock_private_rooms and granted to authenticated only,
-- but this explicitly revokes from anon for defense in depth.

revoke all on function public.create_own_dealership(text, text, text, text, text) from anon;

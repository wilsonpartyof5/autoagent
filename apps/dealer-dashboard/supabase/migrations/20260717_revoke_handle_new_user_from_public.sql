-- Follow-up: the prior migration revoked EXECUTE from anon/authenticated, but
-- PUBLIC still retained EXECUTE, so Data API roles could still call this
-- SECURITY DEFINER trigger helper.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

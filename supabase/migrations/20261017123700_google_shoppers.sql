-- Google shoppers are shoppers, the same as Apple.
-- They get a consumer profile from the sign-in route and no dealer profile row.
-- This keeps the Apple skip from 20261001172059 and adds Google.
-- security definer, search_path, and the execute revoke stay.
--
-- NOT APPLIED. Do not run this against production from the Google sign-in change.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_app_meta_data->>'provider' in ('apple', 'google') then
    return new;
  end if;

  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

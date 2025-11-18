-- Backfill existing data: Create dealerships for existing users
-- This migration creates a default dealership for each user with existing profile data
-- and links their inventory to that dealership

do $$
declare
  user_record record;
  new_dealership_id uuid;
  user_profile_record record;
begin
  -- Loop through all users with profiles
  for user_record in
    select distinct p.id as user_id, p.email
    from profiles p
    where p.id is not null
  loop
    -- Get profile data for this user
    select 
      marketcheck_dealer_id,
      marketcheck_zip
    into user_profile_record
    from profiles
    where id = user_record.user_id;

    -- Create a default dealership for this user
    insert into dealerships (
      name,
      marketcheck_dealer_id,
      marketcheck_zip,
      created_at,
      updated_at
    )
    values (
      coalesce(
        (select dealer_name from inventory_vehicles where user_id = user_record.user_id limit 1),
        'Your Dealership'
      ),
      user_profile_record.marketcheck_dealer_id,
      user_profile_record.marketcheck_zip,
      now(),
      now()
    )
    returning id into new_dealership_id;

    -- Link user to dealership
    insert into user_dealerships (
      user_id,
      dealership_id,
      role,
      created_at
    )
    values (
      user_record.user_id,
      new_dealership_id,
      'owner',
      now()
    )
    on conflict (user_id, dealership_id) do nothing;

    -- Set as active dealership
    insert into user_preferences (
      user_id,
      active_dealership_id,
      created_at,
      updated_at
    )
    values (
      user_record.user_id,
      new_dealership_id,
      now(),
      now()
    )
    on conflict (user_id) 
    do update set 
      active_dealership_id = new_dealership_id,
      updated_at = now();

    -- Update all inventory_vehicles for this user to use the new dealership_id
    update inventory_vehicles
    set dealership_id = new_dealership_id
    where user_id = user_record.user_id
      and dealership_id is null;

    -- Log the backfill (optional, can be removed in production)
    raise notice 'Created dealership % for user %', new_dealership_id, user_record.user_id;
  end loop;
end $$;

-- Verify backfill: Check that all users have at least one dealership
do $$
declare
  users_without_dealerships int;
begin
  select count(*)
  into users_without_dealerships
  from profiles p
  where not exists (
    select 1 from user_dealerships ud
    where ud.user_id = p.id
  );

  if users_without_dealerships > 0 then
    raise warning 'Found % users without dealerships after backfill', users_without_dealerships;
  else
    raise notice 'Backfill complete: All users have at least one dealership';
  end if;
end $$;


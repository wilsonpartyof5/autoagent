-- Consume one car credit when a deal is added.
-- use:<deal id> charges that deal once. A retried add does not charge again.
-- The row lock keeps two deals from spending the same last credit.

create or replace function public.consume_credit_atomic(
  p_user_id uuid,
  p_deal_id uuid
)
returns table(
  consumed boolean,
  already_consumed boolean,
  balance integer,
  lifetime_purchased integer,
  lifetime_used integer,
  lifetime_refunded integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
begin
  if p_deal_id is null then
    raise exception 'deal id is required';
  end if;

  v_key := 'use:' || p_deal_id::text;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
    into v_balance, v_purchased, v_used, v_refunded
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = v_key
  ) then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  if coalesce(v_balance, 0) <= 0 then
    return query select false, false, coalesce(v_balance, 0), coalesce(v_purchased, 0), coalesce(v_used, 0), coalesce(v_refunded, 0);
    return;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, deal_id, idempotency_key
    )
    values (p_user_id, 'use', 1, p_deal_id, v_key);
  exception when unique_violation then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits
  set balance = balance - 1,
      lifetime_used = lifetime_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and balance >= 1
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  if not found then
    raise exception 'car credit was not consumed';
  end if;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

revoke execute on function public.consume_credit_atomic(uuid, uuid) from anon, authenticated, public;
grant execute on function public.consume_credit_atomic(uuid, uuid) to service_role;

-- The service role already inserts and updates deals. Discarding an uncharged
-- add needs delete as well. Shoppers still cannot delete their own rows.
grant select, insert, update, delete on public.shopper_deals to service_role;

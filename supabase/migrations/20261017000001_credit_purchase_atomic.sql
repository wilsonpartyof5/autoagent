-- Atomic car-pack purchase and store refund.
-- purchase:${transactionId} grants a pack once.
-- purchase_reversal:${transactionId} subtracts that pack once, and blocks a later grant.

create or replace function public.purchase_credits_atomic(
  p_user_id uuid,
  p_pack_size integer,
  p_pack_price_usd integer,
  p_idempotency_key text,
  p_reversal_key text
)
returns table(
  granted boolean,
  already_granted boolean,
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
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
begin
  if p_pack_size is null or p_pack_size <= 0 then
    raise exception 'pack size must be positive';
  end if;

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
    where e.user_id = p_user_id and e.idempotency_key = p_idempotency_key
  ) then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = p_reversal_key
  ) then
    return query select false, false, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, pack_size, pack_price_usd, idempotency_key
    )
    values (
      p_user_id, 'purchase', p_pack_size, p_pack_size, p_pack_price_usd, p_idempotency_key
    );
  exception when unique_violation then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits
  set balance = balance + p_pack_size,
      lifetime_purchased = lifetime_purchased + p_pack_size,
      updated_at = now()
  where user_id = p_user_id
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

create or replace function public.reverse_purchase_atomic(
  p_user_id uuid,
  p_amount integer,
  p_purchase_key text,
  p_reversal_key text
)
returns table(
  reversed boolean,
  already_reversed boolean,
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
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
  v_purchased_before boolean;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'reversal amount must be positive';
  end if;

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
    where e.user_id = p_user_id and e.idempotency_key = p_reversal_key
  ) then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  v_purchased_before := exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = p_purchase_key
  );

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, idempotency_key
    )
    values (p_user_id, 'refund', p_amount, p_reversal_key);
  exception when unique_violation then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  if not v_purchased_before then
    return query select false, false, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  update public.shopper_credits
  set balance = greatest(balance - p_amount, 0),
      lifetime_refunded = lifetime_refunded + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

revoke execute on function public.purchase_credits_atomic(uuid, integer, integer, text, text) from anon, authenticated, public;
grant execute on function public.purchase_credits_atomic(uuid, integer, integer, text, text) to service_role;

revoke execute on function public.reverse_purchase_atomic(uuid, integer, text, text) from anon, authenticated, public;
grant execute on function public.reverse_purchase_atomic(uuid, integer, text, text) to service_role;

-- Key-pack pricing (DECIDED 2026-10-26). Draft from DW; not applied here.
-- Replaces car packs 1/3/5/10 at $35/$55/$75/$95 (and older $27/$47/$67/$97).
-- Updates existing public.drevvy_config.pack_sizes_usd only. Does not create
-- that table. Safe no-op when the table or key is missing.

do $$
begin
  if to_regclass('public.drevvy_config') is null then
    raise notice 'public.drevvy_config is not present; skip pack_sizes_usd';
    return;
  end if;

  update public.drevvy_config
     set value = '{"1":4.99,"5":19.99,"10":34.99,"25":74.99}',
         updated_at = timezone('utc', now()),
         note  = 'DECIDED 2026-10-26: one-time key packs (1 key $4.99, 5 $19.99, 10 $34.99 recommended, 25 $74.99); replaces car packs $35/$55/$75/$95'
   where key = 'pack_sizes_usd';
end $$;

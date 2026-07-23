-- Keep the earliest submission when ChatGPT retries the same vehicle in the
-- same flow, then enforce idempotency at the database boundary.
delete from public.leads newer
using public.leads older
where newer.flow_id is not null
  and newer.external_listing_id is not null
  and newer.flow_id = older.flow_id
  and newer.external_listing_id = older.external_listing_id
  and (
    newer.created_at > older.created_at
    or (newer.created_at = older.created_at and newer.id > older.id)
  );

create unique index if not exists idx_leads_unique_flow_listing
  on public.leads (flow_id, external_listing_id)
  where flow_id is not null and external_listing_id is not null;

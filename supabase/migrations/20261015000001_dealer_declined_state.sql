-- Add dealer_declined end state for when a dealer opts out or reports spam.
-- Like ended_no_response, this state returns the shopper's car slot.

alter table public.shopper_deal_lifecycle
  drop constraint shopper_deal_lifecycle_end_state_check;

alter table public.shopper_deal_lifecycle
  add constraint shopper_deal_lifecycle_end_state_check
  check (end_state in ('open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'));

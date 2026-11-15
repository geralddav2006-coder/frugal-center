-- "Frugal Center exclusive" deals become plain "Promotion" deals: same rules
-- (percent off, amount off or a special price, valid between two dates), no
-- exclusive badge or section. Renaming the enum value updates existing deals,
-- the deals_kind_by_type check and the partial index in place.
alter type public.deal_type rename value 'exclusive' to 'promotion';

alter index if exists public.deals_exclusive_type_idx rename to deals_promotion_type_idx;

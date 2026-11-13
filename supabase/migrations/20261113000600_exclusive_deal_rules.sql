-- Exclusives are now a deal type, so the per-deal flag from 000400 is no longer used.
drop index if exists public.deals_exclusive_idx;
alter table public.deals drop column if exists is_exclusive;

-- Exclusives, like off-peak offers, may use a percentage or an amount off the bill.
alter table public.deals drop constraint if exists deals_kind_by_type;
alter table public.deals add constraint deals_kind_by_type
  check (type in ('slow_hours', 'exclusive') or discount_kind = 'fixed_price');

create index if not exists deals_exclusive_type_idx on public.deals (ends_at)
  where type = 'exclusive' and status = 'published' and moderation_removed_at is null;

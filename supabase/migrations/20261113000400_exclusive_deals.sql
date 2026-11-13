-- Frugal Center exclusives: deals a business offers only through Frugal Center.
-- Merchants set the flag in the deal editor; customers browse them under the
-- "Exclusives" tab and see an "Exclusive" badge on cards and the deal page.
alter table public.deals add column if not exists is_exclusive boolean not null default false;

create index if not exists deals_exclusive_idx on public.deals (ends_at)
  where is_exclusive and status = 'published' and moderation_removed_at is null;

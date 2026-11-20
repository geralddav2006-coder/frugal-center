-- Founding businesses: the ones that joined during the free founding period.
-- The badge stays after the free months end, so early businesses keep the credit.
alter table public.businesses add column if not exists founding_member boolean not null default false;
update public.businesses b set founding_member = true
  where exists (select 1 from public.business_subscriptions s where s.business_id = b.id and s.provider = 'founding');

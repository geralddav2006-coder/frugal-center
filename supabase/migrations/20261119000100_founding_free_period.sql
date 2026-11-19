-- Founding businesses: free for their first months, no card needed.
-- Stored as a 'founding' subscription in 'trialing' status that ends at current_period_end.
alter table public.business_subscriptions drop constraint if exists business_subscriptions_provider_check;
alter table public.business_subscriptions
  add constraint business_subscriptions_provider_check check (provider in ('stripe', 'demo', 'founding'));

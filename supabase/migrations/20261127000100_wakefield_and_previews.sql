-- Second launch market: Wakefield, MA and the towns around it (Eastern time).
insert into public.launch_areas (zip, neighborhood, city, state, lat, lng) values
  ('01880', 'Wakefield', 'Wakefield', 'MA', 42.5065, -71.0723),
  ('01867', 'Reading', 'Reading', 'MA', 42.5257, -71.0953),
  ('01940', 'Lynnfield', 'Lynnfield', 'MA', 42.5387, -71.0481),
  ('02176', 'Melrose', 'Melrose', 'MA', 42.4584, -71.0662),
  ('02180', 'Stoneham', 'Stoneham', 'MA', 42.4801, -71.0995),
  ('01906', 'Saugus', 'Saugus', 'MA', 42.4643, -71.0106)
on conflict (zip) do nothing;

-- Private previews: a business page built to show an owner before they join.
-- While preview_token is set the business is hidden everywhere except its secret
-- /p/<token> link, and its deals can't be claimed. Claiming the page clears it.
alter table public.businesses add column if not exists preview_token text unique
  check (preview_token ~ '^[A-Za-z0-9]{16,40}$');

-- Keep previews out of the public Supabase API too (members and admins still see them).
drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read on public.businesses for select to anon, authenticated
  using ((suspended_at is null and preview_token is null) or public.is_business_member(id) or public.is_admin());

drop policy if exists deals_public_read on public.deals;
create policy deals_public_read on public.deals for select to anon, authenticated
  using (
    (status in ('published', 'ended') and moderation_removed_at is null
      and exists (select 1 from public.businesses b where b.id = business_id and b.suspended_at is null and b.preview_token is null))
    or public.is_business_member(business_id)
    or public.is_admin()
  );

-- Row-level security.
--
-- Supabase exposes every table in `public` through its REST API using the
-- anon/authenticated roles. These policies are the firewall for that surface:
--   * reads are limited to what each role should see;
--   * writes that carry business rules (claims, redemptions, deals, billing,
--     businesses, notifications fan-out) have NO client policies at all and are
--     performed only by the Frugal Center server, which validates and
--     authorizes every request before touching the database.

alter table public.categories enable row level security;
alter table public.launch_areas enable row level security;
alter table public.profiles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_invites enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.deals enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.follows enable row level security;
alter table public.favorites enable row level security;
alter table public.claims enable row level security;
alter table public.redemptions enable row level security;
alter table public.notifications enable row level security;
alter table public.email_outbox enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limit_events enable row level security;

-- Table privileges (RLS still applies on top of these).
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
revoke all on public.stripe_events, public.email_outbox, public.audit_log,
  public.rate_limit_events, public.business_invites from anon, authenticated;
-- Customers may only edit harmless profile columns (never `role` or `share_token`).
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, home_zip, home_label, home_lat, home_lng, search_radius_miles)
  on public.profiles to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.follows from authenticated;
grant update (notify) on public.follows to authenticated;

-- Reference data -------------------------------------------------------------
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy launch_areas_read on public.launch_areas for select to anon, authenticated using (true);

-- Profiles -------------------------------------------------------------------
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy prefs_self_read on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());
create policy prefs_self_update on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Businesses -----------------------------------------------------------------
create policy businesses_public_read on public.businesses for select to anon, authenticated
  using (suspended_at is null or public.is_business_member(id) or public.is_admin());

create policy members_read on public.business_members for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id) or public.is_admin());

create policy subscriptions_member_read on public.business_subscriptions for select to authenticated
  using (public.is_business_member(business_id) or public.is_admin());

-- Deals ----------------------------------------------------------------------
create policy deals_public_read on public.deals for select to anon, authenticated
  using (
    (status in ('published', 'ended') and moderation_removed_at is null
      and exists (select 1 from public.businesses b where b.id = business_id and b.suspended_at is null))
    or public.is_business_member(business_id)
    or public.is_admin()
  );

create policy slots_public_read on public.appointment_slots for select to anon, authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id));  -- inherits deals policy

-- Follows & favorites (customers manage their own) ----------------------------
create policy follows_self_read on public.follows for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id));
create policy follows_self_insert on public.follows for insert to authenticated
  with check (user_id = auth.uid());
create policy follows_self_update on public.follows for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy follows_self_delete on public.follows for delete to authenticated
  using (user_id = auth.uid());

create policy favorites_self_read on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_self_insert on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy favorites_self_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

-- Claims & redemptions: read-only to clients ----------------------------------
create policy claims_read on public.claims for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id) or public.is_admin());

create policy redemptions_read on public.redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id) or public.is_admin());

-- Notifications ----------------------------------------------------------------
create policy notifications_self_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_self_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_self_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_self_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Reports ----------------------------------------------------------------------
create policy reports_self_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

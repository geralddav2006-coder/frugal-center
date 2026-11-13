-- Frugal Center core schema
-- Runs on Supabase (where the `auth` schema and the anon/authenticated roles exist)
-- and on the local PGlite demo database (where src/server/db/local.ts creates a
-- compatible `auth` shim first).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'admin');
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.deal_type as enum ('surplus', 'appointment', 'slow_hours');
create type public.discount_kind as enum ('fixed_price', 'percent', 'amount_off');
create type public.deal_status as enum ('draft', 'published', 'paused', 'ended');
create type public.claim_status as enum ('active', 'redeemed', 'canceled');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.subscription_status as enum (
  'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.categories (
  slug text primary key,
  name text not null,
  sort int not null default 0
);

insert into public.categories (slug, name, sort) values
  ('food-drink', 'Food & Drink', 1),
  ('beauty-wellness', 'Beauty & Wellness', 2),
  ('shopping', 'Shopping', 3),
  ('activities', 'Activities', 4),
  ('services', 'Services', 5);

-- ZIP codes in the launch market. Used for manual location selection and as a
-- coordinate fallback when a business address cannot be geocoded.
create table public.launch_areas (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  neighborhood text not null,
  city text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null
);

insert into public.launch_areas (zip, neighborhood, city, state, lat, lng) values
  ('78701', 'Downtown', 'Austin', 'TX', 30.2713, -97.7426),
  ('78702', 'East Austin', 'Austin', 'TX', 30.2635, -97.7166),
  ('78703', 'Clarksville', 'Austin', 'TX', 30.2938, -97.7660),
  ('78704', 'South Congress', 'Austin', 'TX', 30.2429, -97.7658),
  ('78705', 'West Campus', 'Austin', 'TX', 30.2940, -97.7390),
  ('78751', 'Hyde Park', 'Austin', 'TX', 30.3105, -97.7234),
  ('78756', 'Rosedale', 'Austin', 'TX', 30.3221, -97.7392);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 80),
  avatar_url text,
  role public.app_role not null default 'customer',
  home_zip text,
  home_label text check (char_length(home_label) <= 80),
  home_lat double precision check (home_lat between -90 and 90),
  home_lng double precision check (home_lng between -180 and 180),
  search_radius_miles int not null default 10 check (search_radius_miles between 1 and 50),
  share_token text unique,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_new_deals boolean not null default true,
  email_new_deals boolean not null default true,
  push_new_deals boolean not null default false,
  max_emails_per_day int not null default 3 check (max_emails_per_day between 1 and 10),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 2 and 80),
  category_slug text not null references public.categories (slug),
  description text check (char_length(description) <= 1000),
  logo_url text,
  cover_url text,
  address_line text not null check (char_length(address_line) between 3 and 120),
  city text not null,
  state text not null,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  phone text check (char_length(phone) <= 30),
  website text check (char_length(website) <= 200),
  contact_email text check (char_length(contact_email) <= 200),
  timezone text not null default 'America/Chicago',
  -- { "mon": {"open": "07:00", "close": "18:00"}, "sun": null, ... }
  hours jsonb not null default '{}'::jsonb,
  review_status public.review_status not null default 'pending',
  reviewed_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_zip_idx on public.businesses (zip);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);
-- exactly one owner per business
create unique index business_members_one_owner on public.business_members (business_id) where role = 'owner';

create table public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.member_role not null check (role <> 'owner'),
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);

create table public.business_subscriptions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'demo')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status public.subscription_status not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Stripe webhook idempotency
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type public.deal_type not null,
  status public.deal_status not null default 'draft',
  title text not null check (char_length(title) between 3 and 90),
  description text check (char_length(description) <= 2000),
  images text[] not null default '{}' check (cardinality(images) <= 6),
  discount_kind public.discount_kind not null default 'fixed_price',
  original_price_cents int check (original_price_cents > 0 and original_price_cents <= 10000000),
  deal_price_cents int check (deal_price_cents >= 0),
  percent_off int check (percent_off between 1 and 100),
  amount_off_cents int check (amount_off_cents > 0),
  -- null = unlimited (slow-hours deals only). Appointment capacity lives on slots.
  quantity_total int check (quantity_total > 0 and quantity_total <= 10000),
  claimed_count int not null default 0 check (claimed_count >= 0),
  per_customer_limit int not null default 1 check (per_customer_limit between 1 and 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  redemption_instructions text check (char_length(redemption_instructions) <= 1000),
  restrictions text check (char_length(restrictions) <= 1000),
  duration_minutes int check (duration_minutes between 5 and 600),
  -- slow-hours windows, interpreted in the business timezone. 0 = Sunday.
  recurring_days int[] check (recurring_days <@ array[0, 1, 2, 3, 4, 5, 6]),
  window_start time,
  window_end time,
  published_at timestamptz,
  followers_notified_at timestamptz,
  moderation_removed_at timestamptz,
  moderation_note text,
  duplicated_from uuid references public.deals (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_window check (ends_at > starts_at),
  constraint deals_pricing check (
    (discount_kind = 'fixed_price' and original_price_cents is not null and deal_price_cents is not null
       and deal_price_cents < original_price_cents)
    or (discount_kind = 'percent' and percent_off is not null)
    or (discount_kind = 'amount_off' and amount_off_cents is not null)
  ),
  -- variable-total discounts only make sense for slow-hours offers
  constraint deals_kind_by_type check (type = 'slow_hours' or discount_kind = 'fixed_price'),
  constraint deals_capacity check (quantity_total is null or claimed_count <= quantity_total),
  constraint deals_surplus_qty check (type <> 'surplus' or quantity_total is not null),
  constraint deals_slow_hours_window check (
    type <> 'slow_hours' or (recurring_days is not null and cardinality(recurring_days) > 0
      and window_start is not null and window_end is not null and window_end > window_start)
  ),
  constraint deals_appointment_duration check (type <> 'appointment' or duration_minutes is not null)
);
create index deals_business_idx on public.deals (business_id);
create index deals_live_idx on public.deals (status, ends_at) where moderation_removed_at is null;

create table public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  starts_at timestamptz not null,
  capacity int not null check (capacity between 1 and 100),
  claimed_count int not null default 0,
  constraint slots_capacity check (claimed_count between 0 and capacity),
  unique (deal_id, starts_at)
);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------
create table public.follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index follows_business_idx on public.follows (business_id);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deal_id)
);

-- ---------------------------------------------------------------------------
-- Claims (vouchers) and redemptions
-- ---------------------------------------------------------------------------
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete restrict,
  business_id uuid not null references public.businesses (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_id uuid references public.appointment_slots (id) on delete restrict,
  status public.claim_status not null default 'active',
  -- human-readable manual code, e.g. K7QM-X2PA (31-char alphabet, ~8.5e11 combinations)
  code text not null unique check (code ~ '^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'),
  -- unguessable token embedded in the QR code (256 bits, base64url)
  qr_token text not null unique check (char_length(qr_token) >= 40),
  expires_at timestamptz not null,
  -- terms at claim time, so later merchant edits never change an issued voucher
  terms jsonb not null,
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  redeemed_at timestamptz,
  constraint claims_status_ts check (
    (status = 'active' and canceled_at is null and redeemed_at is null)
    or (status = 'canceled' and canceled_at is not null and redeemed_at is null)
    or (status = 'redeemed' and redeemed_at is not null and canceled_at is null)
  )
);
create index claims_user_idx on public.claims (user_id, created_at desc);
create index claims_business_idx on public.claims (business_id, created_at desc);
create index claims_deal_idx on public.claims (deal_id);
-- a customer can hold at most one active voucher per deal
create unique index claims_one_active_per_deal on public.claims (deal_id, user_id) where status = 'active';

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete restrict,
  business_id uuid not null references public.businesses (id) on delete restrict,
  deal_id uuid not null references public.deals (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_by uuid references public.profiles (id) on delete set null,
  method text not null check (method in ('qr', 'code')),
  -- confirmed amounts; savings are derived from these and never recomputed from the deal
  original_amount_cents int not null check (original_amount_cents >= 0),
  final_amount_cents int not null check (final_amount_cents >= 0),
  savings_cents int generated always as (original_amount_cents - final_amount_cents) stored,
  amounts_confirmed_by_merchant boolean not null default false,
  redeemed_at timestamptz not null default now(),
  constraint redemptions_amounts check (final_amount_cents <= original_amount_cents)
);
create index redemptions_user_idx on public.redemptions (user_id, redeemed_at desc);
create index redemptions_business_idx on public.redemptions (business_id, redeemed_at desc);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('new_deal', 'voucher_redeemed', 'system')),
  title text not null,
  body text,
  url text check (url like '/%'),
  business_id uuid references public.businesses (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
-- never notify the same person twice about the same deal
create unique index notifications_dedupe on public.notifications (user_id, type, deal_id) where deal_id is not null;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  to_email text not null,
  subject text not null,
  deal_id uuid references public.deals (id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'not_configured')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index email_outbox_user_idx on public.email_outbox (user_id, created_at desc);
create unique index email_outbox_dedupe on public.email_outbox (user_id, kind, deal_id) where deal_id is not null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trust & safety, operations
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  deal_id uuid references public.deals (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  reason text not null check (reason in ('misleading', 'not_honored', 'inappropriate', 'fraud', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_target check (deal_id is not null or business_id is not null)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.rate_limit_events (
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_idx on public.rate_limit_events (key, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.distance_miles(lat1 double precision, lng1 double precision,
                                                lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 3958.8 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();
create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- Create profile + default preferences for every new auth user, and attach any
-- pending staff invitations for that email address.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80), ''));
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.business_members (business_id, user_id, role)
    select i.business_id, new.id, i.role from public.business_invites i
    where i.email = lower(new.email) and i.accepted_at is null
    on conflict do nothing;
  update public.business_invites set accepted_at = now()
    where email = lower(new.email) and accepted_at is null;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Authorization helpers for RLS. SECURITY DEFINER so they can read membership
-- tables without recursive policy evaluation.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_business_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = bid and user_id = auth.uid())
$$;

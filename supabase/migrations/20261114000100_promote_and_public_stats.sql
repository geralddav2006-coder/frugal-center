-- In-store promotion (printable signs with QR codes) and public redemption stats.

-- Businesses can hide "N deals redeemed · customers saved $X" from their public profile.
alter table public.businesses add column if not exists show_public_stats boolean not null default true;

-- Where a follow came from: null = in the app, 'sign' = scanned one of the business's printed signs.
alter table public.follows add column if not exists source text check (source in ('sign'));
-- Only the server records the source; customers can still follow directly through the API.
revoke insert on public.follows from authenticated;
grant insert (user_id, business_id, notify) on public.follows to authenticated;

-- One row per scan of a business's QR code (counter card, table tent, decal, stickers or shared link).
create table if not exists public.promo_scans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  piece text not null check (piece in ('counter', 'tent', 'decal', 'sticker', 'link', 'other')),
  scanned_at timestamptz not null default now()
);
create index if not exists promo_scans_business_idx on public.promo_scans (business_id, scanned_at desc);

alter table public.promo_scans enable row level security;
grant select on public.promo_scans to authenticated;
-- Members see their own business's scans. Scans are written by the server only.
create policy promo_scans_member_read on public.promo_scans for select to authenticated
  using (public.is_business_member(business_id) or public.is_admin());

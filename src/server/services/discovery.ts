import type { Db, Queryable } from "../db/types";
import type { DealStatus, DealType, DiscountKind } from "@/lib/deals";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DealCard {
  id: string;
  type: DealType;
  status: DealStatus;
  title: string;
  images: string[];
  discount_kind: DiscountKind;
  original_price_cents: number | null;
  deal_price_cents: number | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  quantity_total: number | null;
  claimed_count: number;
  starts_at: Date;
  ends_at: Date;
  published_at: Date | null;
  duration_minutes: number | null;
  recurring_days: number[] | null;
  window_start: string | null;
  window_end: string | null;
  business_id: string;
  business_name: string;
  business_slug: string;
  business_logo: string | null;
  business_cover: string | null;
  category_slug: string;
  lat: number;
  lng: number;
  timezone: string;
  distance_miles: number | null;
  next_slot_at: Date | null;
  slots_remaining: number | null;
  is_favorite: boolean;
}

export type SortKey = "nearest" | "ending" | "newest" | "discount";

export interface DealQuery {
  q?: string;
  category?: string;
  type?: DealType;
  lastMinute?: boolean;
  maxPriceCents?: number;
  radiusMiles?: number;
  sort?: SortKey;
  businessIds?: string[];
  endingWithinHours?: number;
  dealIds?: string[];
  limit?: number;
  /** Show only this private preview business's deals (from its secret /p/<token> link). */
  previewToken?: string;
}

/** SQL predicate for a business anyone can see: not a private preview. Requires alias b. */
export const PUBLIC_BUSINESS_SQL = `b.preview_token is null`;

/** SQL predicate for a deal that can be claimed right now. Requires aliases d (deals) and b (businesses). */
export const LIVE_DEAL_SQL = `
  d.status = 'published' and d.moderation_removed_at is null and b.suspended_at is null
  and d.starts_at <= now() and d.ends_at > now()
  and (d.quantity_total is null or d.claimed_count < d.quantity_total)
  and (d.type <> 'appointment' or exists (
    select 1 from public.appointment_slots s0
    where s0.deal_id = d.id and s0.starts_at > now() and s0.claimed_count < s0.capacity))`;

const CARD_COLUMNS = `
  d.id, d.type, d.status, d.title, d.images, d.discount_kind, d.original_price_cents, d.deal_price_cents,
  d.percent_off, d.amount_off_cents, d.quantity_total, d.claimed_count, d.starts_at, d.ends_at,
  d.published_at, d.duration_minutes, d.recurring_days,
  to_char(d.window_start, 'HH24:MI') as window_start, to_char(d.window_end, 'HH24:MI') as window_end,
  b.id as business_id, b.name as business_name, b.slug as business_slug, b.logo_url as business_logo,
  b.cover_url as business_cover, b.category_slug, b.lat, b.lng, b.timezone,
  s.next_slot_at, s.slots_remaining`;

const SLOTS_LATERAL = `
  left join lateral (
    select min(starts_at) as next_slot_at, sum(capacity - claimed_count)::int as slots_remaining
    from public.appointment_slots
    where deal_id = d.id and starts_at > now() and claimed_count < capacity
  ) s on true`;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listLiveDeals(
  db: Queryable,
  loc: GeoPoint,
  query: DealQuery,
  viewerId: string | null,
): Promise<DealCard[]> {
  const params: unknown[] = [loc.lat, loc.lng, viewerId];
  const where: string[] = [LIVE_DEAL_SQL];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  where.push(query.previewToken ? `b.preview_token = ${p(query.previewToken)}` : PUBLIC_BUSINESS_SQL);

  if (query.q?.trim()) {
    const term = p(`%${escapeLike(query.q.trim().slice(0, 80))}%`);
    where.push(`(d.title ilike ${term} or d.description ilike ${term} or b.name ilike ${term}
      or exists (select 1 from public.categories c where c.slug = b.category_slug and c.name ilike ${term}))`);
  }
  if (query.category) where.push(`b.category_slug = ${p(query.category)}`);
  if (query.type) where.push(`d.type = ${p(query.type)}::public.deal_type`);
  if (query.lastMinute) {
    where.push(`((d.type = 'appointment' and s.next_slot_at < now() + interval '48 hours')
      or d.ends_at < now() + interval '6 hours')`);
  }
  if (query.maxPriceCents != null) {
    where.push(`d.discount_kind = 'fixed_price' and d.deal_price_cents <= ${p(query.maxPriceCents)}`);
  }
  if (query.radiusMiles) where.push(`public.distance_miles($1, $2, b.lat, b.lng) <= ${p(query.radiusMiles)}`);
  if (query.businessIds) where.push(`d.business_id = any(${p(query.businessIds)}::uuid[])`);
  if (query.endingWithinHours) {
    where.push(`coalesce(s.next_slot_at, d.ends_at) < now() + make_interval(hours => ${p(query.endingWithinHours)})`);
  }
  if (query.dealIds) where.push(`d.id = any(${p(query.dealIds)}::uuid[])`);

  const discountExpr = `case
    when d.discount_kind = 'fixed_price' then (d.original_price_cents - d.deal_price_cents)::float / d.original_price_cents * 100
    when d.discount_kind = 'percent' then d.percent_off else 0 end`;
  const order: Record<SortKey, string> = {
    nearest: "distance_miles asc, d.ends_at asc",
    ending: "coalesce(s.next_slot_at, d.ends_at) asc",
    newest: "d.published_at desc nulls last",
    discount: `${discountExpr} desc, distance_miles asc`,
  };

  const limit = Math.min(query.limit ?? 60, 200);
  return db.query<DealCard>(
    `select ${CARD_COLUMNS},
       public.distance_miles($1, $2, b.lat, b.lng) as distance_miles,
       exists (select 1 from public.favorites f where f.deal_id = d.id and f.user_id = $3::uuid) as is_favorite
     from public.deals d
     join public.businesses b on b.id = d.business_id
     ${SLOTS_LATERAL}
     where ${where.join(" and ")}
     order by ${order[query.sort ?? "nearest"]}
     limit ${limit}`,
    params,
  );
}

export interface HomeSections {
  nearYou: DealCard[];
  endingSoon: DealCard[];
  lastMinute: DealCard[];
  following: DealCard[];
  followingCount: number;
}

export async function getHomeSections(
  db: Db,
  loc: GeoPoint & { radiusMiles: number },
  viewerId: string | null,
  category?: string,
): Promise<HomeSections> {
  const base = { radiusMiles: loc.radiusMiles, category, limit: 12 };
  const [nearYou, endingSoon, lastMinute, follows] = await Promise.all([
    listLiveDeals(db, loc, { ...base, sort: "nearest" }, viewerId),
    listLiveDeals(db, loc, { ...base, sort: "ending", endingWithinHours: 24 }, viewerId),
    listLiveDeals(db, loc, { ...base, sort: "ending", type: "appointment", lastMinute: true }, viewerId),
    viewerId
      ? db.query<{ business_id: string }>(`select business_id from public.follows where user_id = $1`, [viewerId])
      : Promise.resolve([]),
  ]);
  const following = follows.length
    ? await listLiveDeals(db, loc, { category, sort: "newest", businessIds: follows.map((f) => f.business_id), limit: 12 }, viewerId)
    : [];
  return { nearYou, endingSoon, lastMinute, following, followingCount: follows.length };
}

// ---------------------------------------------------------------------------
// Deal detail
// ---------------------------------------------------------------------------

export interface Slot {
  id: string;
  starts_at: Date;
  capacity: number;
  claimed_count: number;
}

export interface DealDetail extends DealCard {
  description: string | null;
  redemption_instructions: string | null;
  restrictions: string | null;
  per_customer_limit: number;
  moderation_removed_at: Date | null;
  business_description: string | null;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  business_suspended: boolean;
  /** A private preview built for a business that hasn't joined yet: viewable by link, never claimable. */
  is_preview: boolean;
  slots: Slot[];
  is_live: boolean;
  viewer_is_member: boolean;
  viewer_follows: boolean;
  viewer_active_claim_id: string | null;
  viewer_claims_used: number;
}

export async function getDealDetail(
  db: Queryable,
  dealId: string,
  loc: GeoPoint,
  viewerId: string | null,
  previewToken?: string | null,
): Promise<DealDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) return null;
  const [row] = await db.query<DealDetail & { preview_match: boolean }>(
    `select ${CARD_COLUMNS},
       d.description, d.redemption_instructions, d.restrictions, d.per_customer_limit, d.moderation_removed_at,
       b.description as business_description, b.address_line, b.city, b.state, b.zip, b.phone, b.website,
       (b.suspended_at is not null) as business_suspended,
       (b.preview_token is not null) as is_preview,
       coalesce(b.preview_token = $5::text, false) as preview_match,
       public.distance_miles($2, $3, b.lat, b.lng) as distance_miles,
       exists (select 1 from public.favorites f where f.deal_id = d.id and f.user_id = $4::uuid) as is_favorite,
       (${LIVE_DEAL_SQL}) as is_live,
       exists (select 1 from public.business_members m where m.business_id = b.id and m.user_id = $4::uuid) as viewer_is_member,
       exists (select 1 from public.follows fo where fo.business_id = b.id and fo.user_id = $4::uuid) as viewer_follows,
       (select c.id from public.claims c where c.deal_id = d.id and c.user_id = $4::uuid and c.status = 'active' limit 1) as viewer_active_claim_id,
       (select count(*)::int from public.claims c where c.deal_id = d.id and c.user_id = $4::uuid and c.status <> 'canceled') as viewer_claims_used
     from public.deals d
     join public.businesses b on b.id = d.business_id
     ${SLOTS_LATERAL}
     where d.id = $1`,
    [dealId, loc.lat, loc.lng, viewerId, previewToken ?? null],
  );
  if (!row) return null;
  const { preview_match: previewMatch, ...deal } = row;
  // Public visibility: published/ended deals of non-suspended businesses that were not removed.
  // A private preview's deals are visible only through its secret link.
  const publicVisible =
    (deal.status === "published" || deal.status === "ended") && !deal.moderation_removed_at && !deal.business_suspended &&
    (!deal.is_preview || previewMatch);
  if (!publicVisible && !deal.viewer_is_member) return null;
  if (deal.is_preview) {
    deal.is_live = false; // a preview can be looked at but never claimed
    deal.distance_miles = 0; // shown as the owner sees it in their shop
  }
  deal.slots = await db.query<Slot>(
    `select id, starts_at, capacity, claimed_count from public.appointment_slots
     where deal_id = $1 order by starts_at`,
    [dealId],
  );
  return deal;
}

// ---------------------------------------------------------------------------
// Business profile
// ---------------------------------------------------------------------------

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null;
}

export interface PublicBusiness {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  contact_email: string | null;
  timezone: string;
  hours: BusinessHours;
  follower_count: number;
  distance_miles: number | null;
  viewer_follows: boolean;
  viewer_notify: boolean;
  created_at: Date;
}

const BUSINESS_COLUMNS = `b.id, b.slug, b.name, b.category_slug, b.description, b.logo_url, b.cover_url, b.address_line,
       b.city, b.state, b.zip, b.lat, b.lng, b.phone, b.website, b.contact_email, b.timezone, b.hours, b.created_at,
       (select count(*)::int from public.follows f where f.business_id = b.id) as follower_count,
       public.distance_miles($2, $3, b.lat, b.lng) as distance_miles,
       exists (select 1 from public.follows f where f.business_id = b.id and f.user_id = $4::uuid) as viewer_follows,
       coalesce((select f.notify from public.follows f where f.business_id = b.id and f.user_id = $4::uuid), true) as viewer_notify`;

export async function getBusinessBySlug(db: Queryable, slug: string, loc: GeoPoint, viewerId: string | null) {
  const [biz] = await db.query<PublicBusiness>(
    `select ${BUSINESS_COLUMNS}
     from public.businesses b where b.slug = $1 and b.suspended_at is null and ${PUBLIC_BUSINESS_SQL}`,
    [slug, loc.lat, loc.lng, viewerId],
  );
  if (!biz) return null;
  const deals = await listLiveDeals(db, loc, { businessIds: [biz.id], sort: "ending", limit: 50 }, viewerId);
  return { business: biz, deals };
}

export const PREVIEW_TOKEN = /^[A-Za-z0-9]{16,40}$/;

/** A private preview page, opened from its secret link. Its deals show as they will look, but can't be claimed. */
export async function getBusinessByPreviewToken(db: Queryable, token: string, loc: GeoPoint, viewerId: string | null) {
  if (!PREVIEW_TOKEN.test(token)) return null;
  const [biz] = await db.query<PublicBusiness>(
    `select ${BUSINESS_COLUMNS}
     from public.businesses b where b.preview_token = $1 and b.suspended_at is null`,
    [token, loc.lat, loc.lng, viewerId],
  );
  if (!biz) return null;
  // Show it as the owner sees it standing in their shop, wherever the viewer's saved location is.
  const here = { lat: biz.lat, lng: biz.lng };
  biz.distance_miles = 0;
  const deals = await listLiveDeals(db, here, { previewToken: token, sort: "ending", limit: 50 }, viewerId);
  return { business: biz, deals };
}

export async function listLaunchAreas(db: Queryable) {
  return db.query<{ zip: string; neighborhood: string; city: string; state: string; lat: number; lng: number }>(
    `select zip, neighborhood, city, state, lat, lng from public.launch_areas order by (city = 'Dracut') desc, city, neighborhood`,
  );
}

/** Live deal count and best discount within the viewer's radius (for the hero). */
export async function nearbyStats(db: Queryable, loc: GeoPoint, radiusMiles: number, category?: string) {
  const [r] = await db.query<{ n: number; max_pct: number }>(
    `select count(*)::int as n,
       coalesce(max(case
         when d.discount_kind = 'fixed_price' then round((d.original_price_cents - d.deal_price_cents)::numeric / d.original_price_cents * 100)
         when d.discount_kind = 'percent' then d.percent_off end), 0)::int as max_pct
     from public.deals d join public.businesses b on b.id = d.business_id
     where ${LIVE_DEAL_SQL} and ${PUBLIC_BUSINESS_SQL}
       and public.distance_miles($1, $2, b.lat, b.lng) <= $3
       and ($4::text is null or b.category_slug = $4)`,
    [loc.lat, loc.lng, radiusMiles, category ?? null],
  );
  return { count: r?.n ?? 0, maxPct: r?.max_pct ?? 0 };
}

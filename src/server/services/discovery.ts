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
  exclusive?: boolean; // only Frugal Center exclusives (type = 'exclusive')
  maxPriceCents?: number;
  radiusMiles?: number;
  sort?: SortKey;
  businessIds?: string[];
  categories?: string[];
  publishedWithinHours?: number;
  endingWithinHours?: number;
  excludeIds?: string[];
  dealIds?: string[];
  limit?: number;
}

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

  if (query.q?.trim()) {
    const term = p(`%${escapeLike(query.q.trim().slice(0, 80))}%`);
    where.push(`(d.title ilike ${term} or d.description ilike ${term} or b.name ilike ${term}
      or exists (select 1 from public.categories c where c.slug = b.category_slug and c.name ilike ${term}))`);
  }
  if (query.category) where.push(`b.category_slug = ${p(query.category)}`);
  if (query.categories?.length) where.push(`b.category_slug = any(${p(query.categories)}::text[])`);
  if (query.type) where.push(`d.type = ${p(query.type)}::public.deal_type`);
  if (query.lastMinute) {
    where.push(`((d.type = 'appointment' and s.next_slot_at < now() + interval '48 hours')
      or d.ends_at < now() + interval '6 hours')`);
  }
  if (query.exclusive) where.push(`d.type = 'exclusive'`);
  if (query.maxPriceCents != null) {
    where.push(`d.discount_kind = 'fixed_price' and d.deal_price_cents <= ${p(query.maxPriceCents)}`);
  }
  if (query.radiusMiles) where.push(`public.distance_miles($1, $2, b.lat, b.lng) <= ${p(query.radiusMiles)}`);
  if (query.businessIds) where.push(`d.business_id = any(${p(query.businessIds)}::uuid[])`);
  if (query.publishedWithinHours) {
    where.push(`d.published_at > now() - make_interval(hours => ${p(query.publishedWithinHours)})`);
  }
  if (query.endingWithinHours) {
    where.push(`coalesce(s.next_slot_at, d.ends_at) < now() + make_interval(hours => ${p(query.endingWithinHours)})`);
  }
  if (query.dealIds) where.push(`d.id = any(${p(query.dealIds)}::uuid[])`);
  if (query.excludeIds?.length) where.push(`not (d.id = any(${p(query.excludeIds)}::uuid[]))`);

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
  exclusives: DealCard[];
  endingSoon: DealCard[];
  newToday: DealCard[];
  lastMinute: DealCard[];
  following: DealCard[];
  followingCount: number;
  recommended: DealCard[];
  recommendedReason: string | null;
}

export async function getHomeSections(
  db: Db,
  loc: GeoPoint & { radiusMiles: number },
  viewerId: string | null,
  category?: string,
): Promise<HomeSections> {
  const base = { radiusMiles: loc.radiusMiles, category, limit: 12 };
  const [nearYou, exclusives, endingSoon, newToday, lastMinute] = await Promise.all([
    listLiveDeals(db, loc, { ...base, sort: "nearest" }, viewerId),
    listLiveDeals(db, loc, { ...base, sort: "nearest", exclusive: true }, viewerId),
    listLiveDeals(db, loc, { ...base, sort: "ending", endingWithinHours: 24 }, viewerId),
    listLiveDeals(db, loc, { ...base, sort: "newest", publishedWithinHours: 24 }, viewerId),
    listLiveDeals(db, loc, { ...base, sort: "ending", type: "appointment", lastMinute: true }, viewerId),
  ]);

  let following: DealCard[] = [];
  let followingCount = 0;
  let recommended: DealCard[] = [];
  let recommendedReason: string | null = null;

  if (viewerId) {
    const follows = await db.query<{ business_id: string }>(
      `select business_id from public.follows where user_id = $1`,
      [viewerId],
    );
    followingCount = follows.length;
    if (followingCount) {
      following = await listLiveDeals(
        db,
        loc,
        { category, sort: "newest", businessIds: follows.map((f) => f.business_id), limit: 12 },
        viewerId,
      );
    }
    // Categories the viewer has engaged with: follows, saves and redemptions.
    const cats = await db.query<{ category_slug: string; score: number }>(
      `select b.category_slug, count(*)::int as score from (
         select business_id from public.follows where user_id = $1
         union all select d.business_id from public.favorites f join public.deals d on d.id = f.deal_id where f.user_id = $1
         union all select business_id from public.claims where user_id = $1
       ) x join public.businesses b on b.id = x.business_id
       group by b.category_slug order by score desc limit 2`,
      [viewerId],
    );
    if (cats.length) {
      recommended = await listLiveDeals(
        db,
        loc,
        {
          ...base,
          category: undefined,
          categories: category ? [category] : cats.map((c) => c.category_slug),
          sort: "discount",
          excludeIds: following.map((d) => d.id),
        },
        viewerId,
      );
      recommendedReason = "Based on businesses you follow, save and visit";
    }
  }
  if (!recommended.length) {
    recommended = await listLiveDeals(db, loc, { ...base, sort: "discount" }, viewerId);
    recommendedReason = viewerId ? "Biggest discounts near you" : "Biggest discounts near you";
  }

  return { nearYou, exclusives, endingSoon, newToday, lastMinute, following, followingCount, recommended, recommendedReason };
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
): Promise<DealDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) return null;
  const [deal] = await db.query<DealDetail>(
    `select ${CARD_COLUMNS},
       d.description, d.redemption_instructions, d.restrictions, d.per_customer_limit, d.moderation_removed_at,
       b.description as business_description, b.address_line, b.city, b.state, b.zip, b.phone, b.website,
       (b.suspended_at is not null) as business_suspended,
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
    [dealId, loc.lat, loc.lng, viewerId],
  );
  if (!deal) return null;
  // Public visibility: published/ended deals of non-suspended businesses that were not removed.
  const publicVisible =
    (deal.status === "published" || deal.status === "ended") && !deal.moderation_removed_at && !deal.business_suspended;
  if (!publicVisible && !deal.viewer_is_member) return null;
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
  show_public_stats: boolean;
  redeemed_count: number;
  saved_cents: number;
}

export async function getBusinessBySlug(db: Queryable, slug: string, loc: GeoPoint, viewerId: string | null) {
  const [biz] = await db.query<PublicBusiness>(
    `select b.id, b.slug, b.name, b.category_slug, b.description, b.logo_url, b.cover_url, b.address_line,
       b.city, b.state, b.zip, b.lat, b.lng, b.phone, b.website, b.contact_email, b.timezone, b.hours, b.created_at, b.show_public_stats,
       (select count(*)::int from public.follows f where f.business_id = b.id) as follower_count,
       (select count(*)::int from public.redemptions r where r.business_id = b.id) as redeemed_count,
       (select coalesce(sum(r.savings_cents), 0)::int from public.redemptions r where r.business_id = b.id) as saved_cents,
       public.distance_miles($2, $3, b.lat, b.lng) as distance_miles,
       exists (select 1 from public.follows f where f.business_id = b.id and f.user_id = $4::uuid) as viewer_follows,
       coalesce((select f.notify from public.follows f where f.business_id = b.id and f.user_id = $4::uuid), true) as viewer_notify
     from public.businesses b where b.slug = $1 and b.suspended_at is null`,
    [slug, loc.lat, loc.lng, viewerId],
  );
  if (!biz) return null;
  const deals = await listLiveDeals(db, loc, { businessIds: [biz.id], sort: "ending", limit: 50 }, viewerId);
  return { business: biz, deals };
}

export async function listLaunchAreas(db: Queryable) {
  return db.query<{ zip: string; neighborhood: string; city: string; state: string; lat: number; lng: number }>(
    `select zip, neighborhood, city, state, lat, lng from public.launch_areas order by neighborhood`,
  );
}

/** Live deal count and best discount within the viewer's radius (for the hero). */
export async function nearbyStats(db: Queryable, loc: GeoPoint, radiusMiles: number, category?: string) {
  const [r] = await db.query<{ n: number; max_pct: number; exclusive_n: number }>(
    `select count(*)::int as n, count(*) filter (where d.type = 'exclusive')::int as exclusive_n,
       coalesce(max(case
         when d.discount_kind = 'fixed_price' then round((d.original_price_cents - d.deal_price_cents)::numeric / d.original_price_cents * 100)
         when d.discount_kind = 'percent' then d.percent_off end), 0)::int as max_pct
     from public.deals d join public.businesses b on b.id = d.business_id
     where ${LIVE_DEAL_SQL}
       and public.distance_miles($1, $2, b.lat, b.lng) <= $3
       and ($4::text is null or b.category_slug = $4)`,
    [loc.lat, loc.lng, radiusMiles, category ?? null],
  );
  return { count: r?.n ?? 0, maxPct: r?.max_pct ?? 0, exclusiveCount: r?.exclusive_n ?? 0 };
}

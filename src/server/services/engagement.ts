import type { Queryable } from "../db/types";
import { audit, DomainError, rateLimit } from "./common";

const UUID = /^[0-9a-f-]{36}$/i;

export async function setFollow(q: Queryable, userId: string, businessId: string, follow: boolean) {
  if (!UUID.test(businessId)) throw new DomainError("invalid", "Invalid business.");
  if (follow) {
    const [b] = await q.query(`select 1 from public.businesses where id = $1 and suspended_at is null`, [businessId]);
    if (!b) throw new DomainError("not_found", "Business not found.");
    await q.query(
      `insert into public.follows (user_id, business_id) values ($1, $2) on conflict do nothing`,
      [userId, businessId],
    );
  } else {
    await q.query(`delete from public.follows where user_id = $1 and business_id = $2`, [userId, businessId]);
  }
}

export async function setFollowNotify(q: Queryable, userId: string, businessId: string, notify: boolean) {
  await q.query(`update public.follows set notify = $3 where user_id = $1 and business_id = $2`, [userId, businessId, notify]);
}

export async function setFavorite(q: Queryable, userId: string, dealId: string, save: boolean) {
  if (!UUID.test(dealId)) throw new DomainError("invalid", "Invalid deal.");
  if (save) {
    await q.query(
      `insert into public.favorites (user_id, deal_id) select $1, id from public.deals where id = $2 on conflict do nothing`,
      [userId, dealId],
    );
  } else {
    await q.query(`delete from public.favorites where user_id = $1 and deal_id = $2`, [userId, dealId]);
  }
}

export async function listFollowing(q: Queryable, userId: string) {
  return q.query<{
    business_id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    cover_url: string | null;
    category_slug: string;
    neighborhood: string | null;
    notify: boolean;
    live_deals: number;
    created_at: Date;
  }>(
    `select b.id as business_id, b.name, b.slug, b.logo_url, b.cover_url, b.category_slug, f.notify, f.created_at,
       (select neighborhood from public.launch_areas la where la.zip = b.zip) as neighborhood,
       (select count(*)::int from public.deals d where d.business_id = b.id and d.status = 'published'
          and d.moderation_removed_at is null and d.starts_at <= now() and d.ends_at > now()) as live_deals
     from public.follows f join public.businesses b on b.id = f.business_id
     where f.user_id = $1 and b.suspended_at is null order by f.created_at desc`,
    [userId],
  );
}

export async function listSuggestedBusinesses(q: Queryable, userId: string | null, limit = 6) {
  return q.query<{ id: string; name: string; slug: string; logo_url: string | null; cover_url: string | null; category_slug: string; followers: number }>(
    `select b.id, b.name, b.slug, b.logo_url, b.cover_url, b.category_slug,
       (select count(*)::int from public.follows f where f.business_id = b.id) as followers
     from public.businesses b
     where b.suspended_at is null
       and not exists (select 1 from public.follows f where f.business_id = b.id and f.user_id = $1::uuid)
     order by followers desc, b.created_at desc limit $2`,
    [userId, limit],
  );
}

export async function listSavedDealIds(q: Queryable, userId: string) {
  const rows = await q.query<{ deal_id: string }>(`select deal_id from public.favorites where user_id = $1`, [userId]);
  return rows.map((r) => r.deal_id);
}

export interface Preferences {
  in_app_new_deals: boolean;
  email_new_deals: boolean;
  push_new_deals: boolean;
  max_emails_per_day: number;
}

export async function getPreferences(q: Queryable, userId: string): Promise<Preferences> {
  const [p] = await q.query<Preferences>(
    `select in_app_new_deals, email_new_deals, push_new_deals, max_emails_per_day
     from public.notification_preferences where user_id = $1`,
    [userId],
  );
  return p ?? { in_app_new_deals: true, email_new_deals: true, push_new_deals: false, max_emails_per_day: 3 };
}

export async function updatePreferences(q: Queryable, userId: string, p: Preferences) {
  const max = Math.min(10, Math.max(1, Math.round(p.max_emails_per_day)));
  await q.query(
    `insert into public.notification_preferences (user_id, in_app_new_deals, email_new_deals, push_new_deals, max_emails_per_day)
     values ($1, $2, $3, $4, $5)
     on conflict (user_id) do update set in_app_new_deals = $2, email_new_deals = $3, push_new_deals = $4,
       max_emails_per_day = $5, updated_at = now()`,
    [userId, !!p.in_app_new_deals, !!p.email_new_deals, !!p.push_new_deals, max],
  );
}

export async function markNotificationsRead(q: Queryable, userId: string, id?: string) {
  if (id) {
    await q.query(`update public.notifications set read_at = now() where id = $1 and user_id = $2 and read_at is null`, [id, userId]);
  } else {
    await q.query(`update public.notifications set read_at = now() where user_id = $1 and read_at is null`, [userId]);
  }
}

export async function savePushSubscription(
  q: Queryable,
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  if (!/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000) throw new DomainError("invalid", "Invalid subscription.");
  await q.query(
    `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = $1, p256dh = $3, auth = $4`,
    [userId, sub.endpoint, sub.keys.p256dh.slice(0, 200), sub.keys.auth.slice(0, 100)],
  );
}

export async function removePushSubscription(q: Queryable, userId: string, endpoint: string) {
  await q.query(`delete from public.push_subscriptions where user_id = $1 and endpoint = $2`, [userId, endpoint]);
}

export async function updateProfile(
  q: Queryable,
  userId: string,
  p: { full_name?: string | null; home_zip?: string | null; home_label?: string | null; home_lat?: number | null; home_lng?: number | null; search_radius_miles?: number },
) {
  const name = p.full_name?.trim().slice(0, 80) || null;
  const radius = p.search_radius_miles ? Math.min(50, Math.max(1, Math.round(p.search_radius_miles))) : null;
  await q.query(
    `update public.profiles set
       full_name = coalesce($2, full_name),
       home_zip = coalesce($3, home_zip), home_label = coalesce($4, home_label),
       home_lat = coalesce($5, home_lat), home_lng = coalesce($6, home_lng),
       search_radius_miles = coalesce($7, search_radius_miles)
     where id = $1`,
    [userId, name, p.home_zip ?? null, p.home_label?.slice(0, 80) ?? null, p.home_lat ?? null, p.home_lng ?? null, radius],
  );
}

export async function reportListing(
  q: Queryable,
  userId: string,
  r: { dealId?: string | null; businessId?: string | null; reason: string; details?: string | null },
) {
  if (!["misleading", "not_honored", "inappropriate", "fraud", "other"].includes(r.reason)) {
    throw new DomainError("invalid", "Choose a reason.");
  }
  if (!(await rateLimit(q, `report:${userId}`, 5, 86400))) {
    throw new DomainError("rate_limited", "You've sent several reports today. Our team is reviewing them.");
  }
  let businessId = r.businessId ?? null;
  if (r.dealId) {
    const [d] = await q.query(`select business_id from public.deals where id = $1`, [r.dealId]);
    if (!d) throw new DomainError("not_found", "Deal not found.");
    businessId = d.business_id;
  }
  if (!businessId) throw new DomainError("invalid", "Nothing to report.");
  await q.query(
    `insert into public.reports (reporter_id, deal_id, business_id, reason, details) values ($1, $2, $3, $4, $5)`,
    [userId, r.dealId ?? null, businessId, r.reason, r.details?.slice(0, 1000) ?? null],
  );
  await audit(q, userId, "report.created", "business", businessId, { reason: r.reason, deal_id: r.dealId });
}

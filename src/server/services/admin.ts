import type { Queryable } from "../db/types";
import { audit, DomainError } from "./common";

export async function assertAdmin(q: Queryable, userId: string) {
  const [p] = await q.query(`select role from public.profiles where id = $1`, [userId]);
  if (p?.role !== "admin") throw new DomainError("forbidden", "Admins only.");
}

export async function platformStats(q: Queryable) {
  const [s] = await q.query(
    `select
       (select count(*)::int from public.profiles) as users,
       (select count(*)::int from public.businesses) as businesses,
       (select count(*)::int from public.businesses where review_status = 'pending') as pending_reviews,
       (select count(*)::int from public.business_subscriptions where status in ('active','trialing')) as active_subscriptions,
       (select count(*)::int from public.deals where status = 'published' and moderation_removed_at is null and starts_at <= now() and ends_at > now()) as live_deals,
       (select count(*)::int from public.claims where created_at > now() - interval '7 days') as claims_7d,
       (select count(*)::int from public.redemptions where redeemed_at > now() - interval '7 days') as redemptions_7d,
       (select coalesce(sum(savings_cents),0)::int from public.redemptions) as total_savings_cents,
       (select count(*)::int from public.reports where status = 'open') as open_reports,
       (select count(*)::int from public.email_outbox where status = 'not_configured') as emails_not_sent`,
  );
  return s as Record<string, number>;
}

export async function listBusinessesAdmin(q: Queryable) {
  return q.query(
    `select b.id, b.name, b.slug, b.category_slug, b.city, b.zip, b.review_status, b.suspended_at, b.suspended_reason, b.created_at,
       u.email as owner_email, s.status as subscription_status, s.provider as subscription_provider, s.current_period_end,
       (select count(*)::int from public.deals d where d.business_id = b.id) as deals,
       (select count(*)::int from public.reports r where r.business_id = b.id and r.status = 'open') as open_reports
     from public.businesses b
     left join public.business_members m on m.business_id = b.id and m.role = 'owner'
     left join auth.users u on u.id = m.user_id
     left join public.business_subscriptions s on s.business_id = b.id
     order by (b.review_status = 'pending') desc, b.created_at desc`,
  );
}

export async function reviewBusiness(q: Queryable, adminId: string, businessId: string, decision: "approved" | "rejected") {
  await assertAdmin(q, adminId);
  await q.query(`update public.businesses set review_status = $2::public.review_status, reviewed_at = now() where id = $1`, [
    businessId, decision,
  ]);
  await audit(q, adminId, `business.${decision}`, "business", businessId);
}

/** Suspension hides the business and all its deals and blocks publishing. Issued vouchers stay viewable by customers. */
export async function setBusinessSuspended(q: Queryable, adminId: string, businessId: string, suspended: boolean, reason?: string) {
  await assertAdmin(q, adminId);
  await q.query(
    `update public.businesses set suspended_at = case when $2 then now() else null end,
       suspended_reason = case when $2 then $3 else null end where id = $1`,
    [businessId, suspended, reason?.slice(0, 300) ?? null],
  );
  await audit(q, adminId, suspended ? "business.suspended" : "business.unsuspended", "business", businessId, { reason });
}

export async function listDealsAdmin(q: Queryable, filter: "all" | "live" | "removed" | "reported") {
  const where = {
    all: "true",
    live: "d.status = 'published' and d.moderation_removed_at is null and d.ends_at > now()",
    removed: "d.moderation_removed_at is not null",
    reported: "exists (select 1 from public.reports r where r.deal_id = d.id and r.status = 'open')",
  }[filter];
  return q.query(
    `select d.id, d.title, d.type, d.status, d.starts_at, d.ends_at, d.claimed_count, d.moderation_removed_at, d.moderation_note,
       d.created_at, b.name as business_name, b.slug as business_slug,
       (select count(*)::int from public.reports r where r.deal_id = d.id and r.status = 'open') as open_reports
     from public.deals d join public.businesses b on b.id = d.business_id
     where ${where} order by d.created_at desc limit 200`,
  );
}

export async function setDealRemoved(q: Queryable, adminId: string, dealId: string, removed: boolean, note?: string) {
  await assertAdmin(q, adminId);
  await q.query(
    `update public.deals set moderation_removed_at = case when $2 then now() else null end,
       moderation_note = case when $2 then $3 else null end where id = $1`,
    [dealId, removed, note?.slice(0, 300) ?? null],
  );
  await audit(q, adminId, removed ? "deal.removed" : "deal.restored", "deal", dealId, { note });
}

export async function listReports(q: Queryable) {
  return q.query(
    `select r.id, r.reason, r.details, r.status, r.created_at, r.resolved_at, r.deal_id, d.title as deal_title,
       b.id as business_id, b.name as business_name, b.slug as business_slug, p.full_name as reporter_name
     from public.reports r
     left join public.deals d on d.id = r.deal_id
     left join public.businesses b on b.id = r.business_id
     left join public.profiles p on p.id = r.reporter_id
     order by (r.status = 'open') desc, r.created_at desc limit 200`,
  );
}

export async function resolveReport(q: Queryable, adminId: string, reportId: string, status: "resolved" | "dismissed") {
  await assertAdmin(q, adminId);
  await q.query(`update public.reports set status = $2, resolved_by = $3, resolved_at = now() where id = $1`, [reportId, status, adminId]);
  await audit(q, adminId, `report.${status}`, "report", reportId);
}

export async function listActivity(q: Queryable) {
  const claims = await q.query(
    `select c.id, c.code, c.status, c.created_at, c.expires_at, c.terms ->> 'title' as title, b.name as business_name,
       p.full_name as customer_name, r.savings_cents, r.method, r.redeemed_at
     from public.claims c join public.businesses b on b.id = c.business_id join public.profiles p on p.id = c.user_id
     left join public.redemptions r on r.claim_id = c.id
     order by c.created_at desc limit 100`,
  );
  const log = await q.query(
    `select a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, p.full_name as actor_name
     from public.audit_log a left join public.profiles p on p.id = a.actor_id order by a.created_at desc limit 100`,
  );
  const emails = await q.query(
    `select id, kind, to_email, subject, status, error, created_at from public.email_outbox order by created_at desc limit 50`,
  );
  return { claims, log, emails };
}

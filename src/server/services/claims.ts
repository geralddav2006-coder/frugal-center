import type { Db, Queryable } from "../db/types";
import type { DealType, DiscountKind } from "@/lib/deals";
import { DomainError, generateManualCode, generateToken, isUniqueViolation, rateLimit } from "./common";

/** Terms frozen onto the voucher at claim time. */
export interface ClaimTerms {
  title: string;
  type: DealType;
  discount_kind: DiscountKind;
  original_price_cents: number | null;
  deal_price_cents: number | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  recurring_days: number[] | null;
  window_start: string | null;
  window_end: string | null;
  slot_starts_at: string | null;
  duration_minutes: number | null;
  redemption_instructions: string | null;
  restrictions: string | null;
  business_name: string;
  timezone: string;
}

export async function claimDeal(
  db: Db,
  userId: string,
  dealId: string,
  slotId: string | null,
): Promise<{ claimId: string }> {
  if (!(await rateLimit(db, `claim:${userId}`, 20, 3600))) {
    throw new DomainError("rate_limited", "You've claimed a lot of deals in the last hour. Please try again later.");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.tx((q) => claimOnce(q, userId, dealId, slotId));
    } catch (err) {
      if (isUniqueViolation(err, "claims_one_active_per_deal")) {
        const [existing] = await db.query<{ id: string }>(
          `select id from public.claims where deal_id = $1 and user_id = $2 and status = 'active'`,
          [dealId, userId],
        );
        throw new DomainError("already_claimed", "You already have an active voucher for this deal.", {
          claimId: existing?.id,
        });
      }
      // Code/token collision (astronomically rare): retry with fresh values.
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new DomainError("claim_failed", "We couldn't claim this deal. Please try again.");
}

async function claimOnce(q: Queryable, userId: string, dealId: string, slotId: string | null) {
  const [d] = await q.query(
    `select d.*, to_char(d.window_start, 'HH24:MI') as ws, to_char(d.window_end, 'HH24:MI') as we,
            b.name as business_name, b.timezone, b.suspended_at, (b.preview_token is not null) as is_preview,
            (d.starts_at <= now()) as started, (d.ends_at > now()) as not_ended
     from public.deals d join public.businesses b on b.id = d.business_id
     where d.id = $1 for update of d`,
    [dealId],
  );
  if (!d || d.moderation_removed_at || d.suspended_at || d.status === "draft" || d.is_preview) {
    throw new DomainError("not_found", "This deal isn't available.");
  }
  if (d.status === "paused") throw new DomainError("paused", "This deal is paused by the business right now.");
  if (d.status === "ended" || !d.not_ended) throw new DomainError("expired", "This deal has ended.");
  if (!d.started) throw new DomainError("not_started", "This deal hasn't started yet.");

  const [member] = await q.query(
    `select 1 from public.business_members where business_id = $1 and user_id = $2`,
    [d.business_id, userId],
  );
  if (member) throw new DomainError("own_business", "You can't claim deals from a business you work for.");

  const [used] = await q.query<{ active: number; total: number }>(
    `select count(*) filter (where status = 'active')::int as active, count(*)::int as total
     from public.claims where deal_id = $1 and user_id = $2 and status <> 'canceled'`,
    [dealId, userId],
  );
  if (used!.active > 0) {
    const [existing] = await q.query<{ id: string }>(
      `select id from public.claims where deal_id = $1 and user_id = $2 and status = 'active'`,
      [dealId, userId],
    );
    throw new DomainError("already_claimed", "You already have an active voucher for this deal.", {
      claimId: existing?.id,
    });
  }
  if (used!.total >= d.per_customer_limit) {
    throw new DomainError("limit_reached", "You've reached the limit for this deal.");
  }

  let expiresAt: Date;
  let slotStartsAt: Date | null = null;
  if (d.type === "appointment") {
    if (!slotId) throw new DomainError("slot_required", "Choose an available time.");
    const [slot] = await q.query(
      `select *, (starts_at > now()) as future from public.appointment_slots
       where id = $1 and deal_id = $2 for update`,
      [slotId, dealId],
    );
    if (!slot) throw new DomainError("slot_required", "Choose an available time.");
    if (!slot.future) throw new DomainError("slot_passed", "That time has already passed.");
    if (slot.claimed_count >= slot.capacity) throw new DomainError("slot_full", "That time was just booked. Pick another.");
    await q.query(`update public.appointment_slots set claimed_count = claimed_count + 1 where id = $1`, [slotId]);
    slotStartsAt = new Date(slot.starts_at);
    expiresAt = new Date(slotStartsAt.getTime() + (d.duration_minutes ?? 60) * 60000);
  } else {
    if (d.quantity_total != null && d.claimed_count >= d.quantity_total) {
      throw new DomainError("sold_out", "This deal just sold out.");
    }
    expiresAt = new Date(d.ends_at);
  }
  await q.query(`update public.deals set claimed_count = claimed_count + 1 where id = $1`, [dealId]);

  // Collision-checked manual code (the unique index is the final guarantee).
  let code = generateManualCode();
  for (let i = 0; i < 5; i++) {
    const [clash] = await q.query(`select 1 from public.claims where code = $1`, [code]);
    if (!clash) break;
    code = generateManualCode();
  }

  const terms: ClaimTerms = {
    title: d.title,
    type: d.type,
    discount_kind: d.discount_kind,
    original_price_cents: d.original_price_cents,
    deal_price_cents: d.deal_price_cents,
    percent_off: d.percent_off,
    amount_off_cents: d.amount_off_cents,
    recurring_days: d.recurring_days,
    window_start: d.ws,
    window_end: d.we,
    slot_starts_at: slotStartsAt?.toISOString() ?? null,
    duration_minutes: d.duration_minutes,
    redemption_instructions: d.redemption_instructions,
    restrictions: d.restrictions,
    business_name: d.business_name,
    timezone: d.timezone,
  };

  const [claim] = await q.query<{ id: string }>(
    `insert into public.claims (deal_id, business_id, user_id, slot_id, code, qr_token, expires_at, terms)
     values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8) returning id`,
    [dealId, d.business_id, userId, slotId, code, generateToken(32), expiresAt.toISOString(), JSON.stringify(terms)],
  );
  return { claimId: claim!.id };
}

export async function cancelClaim(db: Db, userId: string, claimId: string) {
  return db.tx(async (q) => {
    const [c] = await q.query(
      `select * from public.claims where id = $1 and user_id = $2 for update`,
      [claimId, userId],
    );
    if (!c) throw new DomainError("not_found", "Voucher not found.");
    if (c.status !== "active") throw new DomainError("not_active", "Only active vouchers can be canceled.");
    await q.query(`update public.claims set status = 'canceled', canceled_at = now() where id = $1`, [claimId]);
    // Release capacity so someone else can claim it.
    await q.query(`update public.deals set claimed_count = greatest(claimed_count - 1, 0) where id = $1`, [c.deal_id]);
    if (c.slot_id) {
      await q.query(
        `update public.appointment_slots set claimed_count = greatest(claimed_count - 1, 0) where id = $1`,
        [c.slot_id],
      );
    }
  });
}

export type VoucherState = "active" | "redeemed" | "canceled" | "expired";

export interface VoucherRow {
  id: string;
  deal_id: string;
  business_id: string;
  status: "active" | "redeemed" | "canceled";
  state: VoucherState;
  code: string;
  qr_token: string;
  expires_at: Date;
  created_at: Date;
  redeemed_at: Date | null;
  canceled_at: Date | null;
  terms: ClaimTerms;
  business_name: string;
  business_slug: string;
  business_logo: string | null;
  address_line: string;
  city: string;
  image: string | null;
  savings_cents: number | null;
  final_amount_cents: number | null;
}

const VOUCHER_SELECT = `
  select c.id, c.deal_id, c.business_id, c.status, c.code, c.qr_token, c.expires_at, c.created_at,
    c.redeemed_at, c.canceled_at, c.terms,
    case when c.status = 'active' and c.expires_at <= now() then 'expired' else c.status::text end as state,
    b.name as business_name, b.slug as business_slug, b.logo_url as business_logo, b.address_line, b.city,
    d.images[1] as image, r.savings_cents, r.final_amount_cents
  from public.claims c
  join public.businesses b on b.id = c.business_id
  join public.deals d on d.id = c.deal_id
  left join public.redemptions r on r.claim_id = c.id`;

export async function getVoucher(db: Queryable, userId: string, claimId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return null;
  const [v] = await db.query<VoucherRow>(`${VOUCHER_SELECT} where c.id = $1 and c.user_id = $2`, [claimId, userId]);
  return v ?? null;
}

export async function listVouchers(db: Queryable, userId: string) {
  return db.query<VoucherRow>(`${VOUCHER_SELECT} where c.user_id = $1 order by c.created_at desc limit 200`, [userId]);
}

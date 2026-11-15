import type { Db, Queryable } from "../db/types";
import { slugify } from "@/lib/utils";
import { zonedInputToDate } from "@/lib/time";
import { assertCanPublish } from "./billing";
import { audit, DomainError } from "./common";
import { requireMember } from "./redemption";
import { businessSchema, dealSchema, firstIssue, type BusinessInput, type DealInput } from "./schemas";

export const MAX_DEAL_DAYS = 60;

export interface Membership {
  business_id: string;
  role: "owner" | "manager" | "staff";
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  suspended_at: Date | null;
}

export async function listMemberships(q: Queryable, userId: string) {
  return q.query<Membership>(
    `select m.business_id, m.role, b.name, b.slug, b.logo_url, b.timezone, b.suspended_at
     from public.business_members m join public.businesses b on b.id = m.business_id
     where m.user_id = $1 order by m.created_at`,
    [userId],
  );
}

async function resolveCoords(q: Queryable, zip: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null && !(lat === 0 && lng === 0)) return { lat, lng };
  const [area] = await q.query<{ lat: number; lng: number }>(`select lat, lng from public.launch_areas where zip = $1`, [zip]);
  if (!area) {
    throw new DomainError(
      "location_required",
      "We couldn't place that ZIP on the map. Drop a pin on the map to set your exact location.",
    );
  }
  return area;
}

export async function createBusiness(db: Db, userId: string, raw: BusinessInput) {
  const parsed = businessSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid", firstIssue(parsed.error));
  const b = parsed.data;
  const existing = await listMemberships(db, userId);
  if (existing.some((m) => m.role === "owner")) {
    throw new DomainError("already_owner", "You already own a business on Frugal Center.");
  }
  const coords = await resolveCoords(db, b.zip, b.lat, b.lng);
  return db.tx(async (q) => {
    const base = slugify(b.name) || "business";
    let slug = base;
    for (let i = 2; ; i++) {
      const [taken] = await q.query(`select 1 from public.businesses where slug = $1`, [slug]);
      if (!taken) break;
      slug = `${base}-${i}`;
    }
    const [row] = await q.query<{ id: string; slug: string }>(
      `insert into public.businesses (slug, name, category_slug, description, logo_url, cover_url, address_line, city,
         state, zip, lat, lng, phone, website, contact_email, hours, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id, slug`,
      [slug, b.name, b.category_slug, b.description, b.logo_url ?? null, b.cover_url ?? null, b.address_line, b.city,
        b.state, b.zip, coords.lat, coords.lng, b.phone, b.website, b.contact_email, JSON.stringify(b.hours), userId],
    );
    await q.query(`insert into public.business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [row!.id, userId]);
    await audit(q, userId, "business.created", "business", row!.id, { name: b.name });
    return row!;
  });
}

export async function updateBusiness(db: Db, userId: string, businessId: string, raw: BusinessInput) {
  await requireMember(db, userId, businessId, ["owner", "manager"]);
  const parsed = businessSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid", firstIssue(parsed.error));
  const b = parsed.data;
  const coords = await resolveCoords(db, b.zip, b.lat, b.lng);
  await db.query(
    `update public.businesses set name=$2, category_slug=$3, description=$4, logo_url=$5, cover_url=$6, address_line=$7,
       city=$8, state=$9, zip=$10, lat=$11, lng=$12, phone=$13, website=$14, contact_email=$15, hours=$16
     where id = $1`,
    [businessId, b.name, b.category_slug, b.description, b.logo_url ?? null, b.cover_url ?? null, b.address_line,
      b.city, b.state, b.zip, coords.lat, coords.lng, b.phone, b.website, b.contact_email, JSON.stringify(b.hours)],
  );
  await audit(db, userId, "business.updated", "business", businessId);
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export async function listTeam(q: Queryable, businessId: string) {
  const members = await q.query<{ user_id: string; role: string; full_name: string | null; email: string; created_at: Date }>(
    `select m.user_id, m.role, p.full_name, u.email, m.created_at
     from public.business_members m join public.profiles p on p.id = m.user_id join auth.users u on u.id = m.user_id
     where m.business_id = $1 order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at`,
    [businessId],
  );
  const invites = await q.query<{ id: string; email: string; role: string; created_at: Date }>(
    `select id, email, role, created_at from public.business_invites
     where business_id = $1 and accepted_at is null order by created_at desc`,
    [businessId],
  );
  return { members, invites };
}

export async function inviteTeamMember(db: Db, actorId: string, businessId: string, emailRaw: string, role: "manager" | "staff") {
  await requireMember(db, actorId, businessId, ["owner", "manager"]);
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("invalid", "Enter a valid email address.");
  if (!["manager", "staff"].includes(role)) throw new DomainError("invalid", "Invalid role.");
  const [user] = await db.query<{ id: string }>(`select id from auth.users where lower(email) = $1`, [email]);
  if (user) {
    const added = await db.query(
      `insert into public.business_members (business_id, user_id, role) values ($1, $2, $3::public.member_role)
       on conflict do nothing returning user_id`,
      [businessId, user.id, role],
    );
    if (!added.length) throw new DomainError("exists", "That person is already on your team.");
    await audit(db, actorId, "team.added", "business", businessId, { email, role });
    return { added: true };
  }
  await db.query(
    `insert into public.business_invites (business_id, email, role, invited_by) values ($1, $2, $3::public.member_role, $4)
     on conflict (business_id, email) do update set role = excluded.role, accepted_at = null`,
    [businessId, email, role, actorId],
  );
  await audit(db, actorId, "team.invited", "business", businessId, { email, role });
  return { added: false };
}

export async function removeTeamMember(db: Db, actorId: string, businessId: string, userId: string) {
  await requireMember(db, actorId, businessId, ["owner", "manager"]);
  const [target] = await db.query(`select role from public.business_members where business_id=$1 and user_id=$2`, [businessId, userId]);
  if (!target) return;
  if (target.role === "owner") throw new DomainError("forbidden", "The owner can't be removed.");
  await db.query(`delete from public.business_members where business_id = $1 and user_id = $2`, [businessId, userId]);
  await audit(db, actorId, "team.removed", "business", businessId, { user_id: userId });
}

export async function revokeInvite(db: Db, actorId: string, businessId: string, inviteId: string) {
  await requireMember(db, actorId, businessId, ["owner", "manager"]);
  await db.query(`delete from public.business_invites where id = $1 and business_id = $2`, [inviteId, businessId]);
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export interface MerchantDeal {
  id: string;
  type: string;
  status: string;
  title: string;
  images: string[];
  discount_kind: string;
  original_price_cents: number | null;
  deal_price_cents: number | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  quantity_total: number | null;
  claimed_count: number;
  per_customer_limit: number;
  starts_at: Date;
  ends_at: Date;
  published_at: Date | null;
  followers_notified_at: Date | null;
  moderation_removed_at: Date | null;
  description: string | null;
  redemption_instructions: string | null;
  restrictions: string | null;
  duration_minutes: number | null;
  recurring_days: number[] | null;
  window_start: string | null;
  window_end: string | null;
  claims_total: number;
  redemptions_total: number;
  state: "draft" | "scheduled" | "live" | "paused" | "ended" | "sold_out" | "removed";
}

const STATE_SQL = `case
  when d.moderation_removed_at is not null then 'removed'
  when d.status = 'draft' then 'draft'
  when d.status = 'paused' then 'paused'
  when d.status = 'ended' or d.ends_at <= now() then 'ended'
  when d.starts_at > now() then 'scheduled'
  when d.type = 'appointment' and not exists (select 1 from public.appointment_slots s
       where s.deal_id = d.id and s.starts_at > now() and s.claimed_count < s.capacity) then 'sold_out'
  when d.quantity_total is not null and d.claimed_count >= d.quantity_total then 'sold_out'
  else 'live' end`;

const MERCHANT_DEAL_SELECT = `
  select d.id, d.type, d.status, d.title, d.images, d.discount_kind, d.original_price_cents, d.deal_price_cents,
    d.percent_off, d.amount_off_cents, d.quantity_total, d.claimed_count, d.per_customer_limit, d.starts_at, d.ends_at,
    d.published_at, d.followers_notified_at, d.moderation_removed_at, d.description, d.redemption_instructions,
    d.restrictions, d.duration_minutes, d.recurring_days,
    to_char(d.window_start, 'HH24:MI') as window_start, to_char(d.window_end, 'HH24:MI') as window_end,
    (select count(*)::int from public.claims c where c.deal_id = d.id) as claims_total,
    (select count(*)::int from public.redemptions r where r.deal_id = d.id) as redemptions_total,
    ${STATE_SQL} as state
  from public.deals d`;

export async function listMerchantDeals(q: Queryable, businessId: string) {
  return q.query<MerchantDeal>(`${MERCHANT_DEAL_SELECT} where d.business_id = $1 order by d.created_at desc`, [businessId]);
}

export async function getMerchantDeal(q: Queryable, userId: string, dealId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) return null;
  const [d] = await q.query<MerchantDeal & { business_id: string }>(
    `${MERCHANT_DEAL_SELECT.replace("select d.id,", "select d.business_id, d.id,")}
     where d.id = $1 and exists (select 1 from public.business_members m where m.business_id = d.business_id and m.user_id = $2)`,
    [dealId, userId],
  );
  if (!d) return null;
  const slots = await q.query<{ id: string; starts_at: Date; capacity: number; claimed_count: number }>(
    `select id, starts_at, capacity, claimed_count from public.appointment_slots where deal_id = $1 order by starts_at`,
    [dealId],
  );
  return { ...d, slots };
}

interface NormalizedDeal {
  type: string;
  title: string;
  description: string | null;
  images: string[];
  redemption_instructions: string | null;
  restrictions: string | null;
  per_customer_limit: number;
  discount_kind: string;
  original_price_cents: number | null;
  deal_price_cents: number | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  quantity_total: number | null;
  starts_at: Date;
  ends_at: Date;
  duration_minutes: number | null;
  recurring_days: number[] | null;
  window_start: string | null;
  window_end: string | null;
  slots: { id?: string; starts_at: Date; capacity: number }[];
}

function normalizeDeal(raw: DealInput, tz: string): NormalizedDeal {
  const parsed = dealSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid", firstIssue(parsed.error));
  const d = parsed.data;
  const base = {
    type: d.type,
    title: d.title,
    description: d.description,
    images: d.images,
    redemption_instructions: d.redemption_instructions,
    restrictions: d.restrictions,
    per_customer_limit: d.per_customer_limit,
    duration_minutes: null as number | null,
    recurring_days: null as number[] | null,
    window_start: null as string | null,
    window_end: null as string | null,
    slots: [] as NormalizedDeal["slots"],
    percent_off: null as number | null,
    amount_off_cents: null as number | null,
  };
  const checkFixed = (o: number | null | undefined, p: number | null | undefined) => {
    if (o == null || o <= 0) throw new DomainError("invalid", "Enter the regular price.");
    if (p == null) throw new DomainError("invalid", "Enter the discounted price.");
    if (p >= o) throw new DomainError("invalid", "The discounted price must be lower than the regular price.");
  };

  let out: NormalizedDeal;
  if (d.type === "surplus") {
    checkFixed(d.original_price, d.deal_price);
    out = {
      ...base,
      discount_kind: "fixed_price",
      original_price_cents: d.original_price,
      deal_price_cents: d.deal_price,
      quantity_total: d.quantity_total,
      starts_at: zonedInputToDate(d.starts_at, tz),
      ends_at: zonedInputToDate(d.ends_at, tz),
    };
  } else if (d.type === "appointment") {
    checkFixed(d.original_price, d.deal_price);
    const slots = d.slots
      .map((s) => ({ id: s.id, starts_at: zonedInputToDate(s.starts_at, tz), capacity: s.capacity }))
      .sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
    if (new Set(slots.map((s) => s.starts_at.getTime())).size !== slots.length) {
      throw new DomainError("invalid", "Two time slots have the same start time.");
    }
    out = {
      ...base,
      discount_kind: "fixed_price",
      original_price_cents: d.original_price,
      deal_price_cents: d.deal_price,
      quantity_total: null,
      duration_minutes: d.duration_minutes,
      slots,
      starts_at: new Date(),
      ends_at: slots.at(-1)!.starts_at,
    };
  } else {
    // Off-peak offers and promotions: percent off, amount off, or a special price.
    let pricing: Pick<NormalizedDeal, "original_price_cents" | "deal_price_cents" | "percent_off" | "amount_off_cents">;
    if (d.discount_kind === "percent") {
      if (!d.percent_off) throw new DomainError("invalid", "Enter the percentage off.");
      pricing = { original_price_cents: null, deal_price_cents: null, percent_off: d.percent_off, amount_off_cents: null };
    } else if (d.discount_kind === "amount_off") {
      if (!d.amount_off) throw new DomainError("invalid", "Enter the amount off.");
      pricing = { original_price_cents: null, deal_price_cents: null, percent_off: null, amount_off_cents: d.amount_off };
    } else {
      checkFixed(d.original_price, d.deal_price);
      pricing = { original_price_cents: d.original_price!, deal_price_cents: d.deal_price!, percent_off: null, amount_off_cents: null };
    }
    const dates = { starts_at: zonedInputToDate(d.starts_at, tz), ends_at: zonedInputToDate(d.ends_at, tz) };
    if (d.type === "promotion") {
      out = { ...base, ...pricing, ...dates, discount_kind: d.discount_kind, quantity_total: d.quantity_total ?? null };
    } else {
      if (d.window_end <= d.window_start) throw new DomainError("invalid", "The end time must be after the start time.");
      out = {
        ...base,
        ...pricing,
        ...dates,
        discount_kind: d.discount_kind,
        quantity_total: d.quantity_total ?? null,
        recurring_days: [...new Set(d.recurring_days)].sort(),
        window_start: d.window_start,
        window_end: d.window_end,
      };
    }
  }
  if (out.ends_at <= out.starts_at) throw new DomainError("invalid", "The end must be after the start.");
  if (out.ends_at.getTime() - out.starts_at.getTime() > MAX_DEAL_DAYS * 86400000) {
    throw new DomainError("invalid", `Deals can run for at most ${MAX_DEAL_DAYS} days.`);
  }
  return out;
}

/** Create or update a deal. Edits after customers have claimed are restricted to non-term fields. */
export async function saveDeal(db: Db, userId: string, businessId: string, raw: DealInput, dealId?: string) {
  await requireMember(db, userId, businessId, ["owner", "manager"]);
  const [biz] = await db.query<{ timezone: string }>(`select timezone from public.businesses where id = $1`, [businessId]);
  if (!biz) throw new DomainError("not_found", "Business not found.");
  const n = normalizeDeal(raw, biz.timezone);

  return db.tx(async (q) => {
    if (!dealId) {
      const [row] = await q.query<{ id: string }>(
        `insert into public.deals (business_id, type, title, description, images, discount_kind, original_price_cents,
           deal_price_cents, percent_off, amount_off_cents, quantity_total, per_customer_limit, starts_at, ends_at,
           redemption_instructions, restrictions, duration_minutes, recurring_days, window_start, window_end, created_by)
         values ($1, $2::public.deal_type, $3, $4, $5::text[], $6::public.discount_kind, $7, $8, $9, $10, $11, $12,
           $13::timestamptz, $14::timestamptz, $15, $16, $17, $18::int[], $19::time, $20::time, $21) returning id`,
        [businessId, n.type, n.title, n.description, n.images, n.discount_kind, n.original_price_cents, n.deal_price_cents,
          n.percent_off, n.amount_off_cents, n.quantity_total, n.per_customer_limit, n.starts_at.toISOString(),
          n.ends_at.toISOString(), n.redemption_instructions, n.restrictions, n.duration_minutes, n.recurring_days,
          n.window_start, n.window_end, userId],
      );
      for (const s of n.slots) {
        await q.query(
          `insert into public.appointment_slots (deal_id, starts_at, capacity) values ($1, $2::timestamptz, $3)`,
          [row!.id, s.starts_at.toISOString(), s.capacity],
        );
      }
      await audit(q, userId, "deal.created", "deal", row!.id);
      return { id: row!.id };
    }

    const [cur] = await q.query(
      `select *, to_char(window_start, 'HH24:MI') as ws, to_char(window_end, 'HH24:MI') as we,
         (select count(*)::int from public.claims c where c.deal_id = d.id) as claims
       from public.deals d where id = $1 and business_id = $2 for update`,
      [dealId, businessId],
    );
    if (!cur) throw new DomainError("not_found", "Deal not found.");
    if (cur.moderation_removed_at) throw new DomainError("removed", "This deal was removed by moderation and can't be edited.");
    if (cur.type !== n.type) throw new DomainError("invalid", "A deal's type can't be changed. Create a new deal instead.");

    if (cur.claims > 0) {
      const changed =
        cur.discount_kind !== n.discount_kind ||
        cur.original_price_cents !== n.original_price_cents ||
        cur.deal_price_cents !== n.deal_price_cents ||
        cur.percent_off !== n.percent_off ||
        cur.amount_off_cents !== n.amount_off_cents ||
        (cur.type === "slow_hours" &&
          (cur.ws !== n.window_start || cur.we !== n.window_end ||
            JSON.stringify(cur.recurring_days) !== JSON.stringify(n.recurring_days)));
      if (changed) {
        throw new DomainError(
          "locked_terms",
          "Customers have already claimed this deal, so its price and schedule are locked. End it and create a new one to change terms.",
        );
      }
      if (n.quantity_total != null && n.quantity_total < cur.claimed_count) {
        throw new DomainError("invalid", `Quantity can't be lower than the ${cur.claimed_count} already claimed.`);
      }
    }

    const startsAt = cur.type === "appointment" ? new Date(cur.starts_at) : n.starts_at;
    await q.query(
      `update public.deals set title=$2, description=$3, images=$4::text[], discount_kind=$5::public.discount_kind,
         original_price_cents=$6, deal_price_cents=$7, percent_off=$8, amount_off_cents=$9, quantity_total=$10,
         per_customer_limit=$11, starts_at=$12::timestamptz, ends_at=$13::timestamptz, redemption_instructions=$14,
         restrictions=$15, duration_minutes=$16, recurring_days=$17::int[], window_start=$18::time, window_end=$19::time
       where id = $1`,
      [dealId, n.title, n.description, n.images, n.discount_kind, n.original_price_cents, n.deal_price_cents,
        n.percent_off, n.amount_off_cents, n.quantity_total, n.per_customer_limit, startsAt.toISOString(),
        n.ends_at.toISOString(), n.redemption_instructions, n.restrictions, n.duration_minutes, n.recurring_days,
        n.window_start, n.window_end],
    );

    if (cur.type === "appointment") {
      const existing = await q.query<{ id: string; starts_at: Date; claimed_count: number }>(
        `select id, starts_at, claimed_count from public.appointment_slots where deal_id = $1`,
        [dealId],
      );
      const keep = new Set(n.slots.filter((s) => s.id).map((s) => s.id));
      for (const e of existing) {
        if (!keep.has(e.id)) {
          const [held] = await q.query(`select 1 from public.claims where slot_id = $1 limit 1`, [e.id]);
          if (held) throw new DomainError("locked_slot", "A time slot that customers have booked can't be removed.");
          await q.query(`delete from public.appointment_slots where id = $1`, [e.id]);
        }
      }
      for (const s of n.slots) {
        const prev = existing.find((e) => e.id === s.id);
        if (prev) {
          if (prev.claimed_count > 0 && new Date(prev.starts_at).getTime() !== s.starts_at.getTime()) {
            throw new DomainError("locked_slot", "A booked time slot can't be moved.");
          }
          if (s.capacity < prev.claimed_count) {
            throw new DomainError("invalid", "A slot's capacity can't be lower than its bookings.");
          }
          await q.query(`update public.appointment_slots set starts_at = $2::timestamptz, capacity = $3 where id = $1`, [
            s.id, s.starts_at.toISOString(), s.capacity,
          ]);
        } else {
          await q.query(`insert into public.appointment_slots (deal_id, starts_at, capacity) values ($1, $2::timestamptz, $3)`, [
            dealId, s.starts_at.toISOString(), s.capacity,
          ]);
        }
      }
      await q.query(
        `update public.deals set ends_at = (select max(starts_at) from public.appointment_slots where deal_id = $1) where id = $1`,
        [dealId],
      );
    }
    await audit(q, userId, "deal.updated", "deal", dealId);
    return { id: dealId };
  });
}

async function loadOwnedDeal(q: Queryable, userId: string, dealId: string, roles = ["owner", "manager"]) {
  const [d] = await q.query(`select * from public.deals where id = $1`, [dealId]);
  if (!d) throw new DomainError("not_found", "Deal not found.");
  await requireMember(q, userId, d.business_id, roles);
  if (d.moderation_removed_at) throw new DomainError("removed", "This deal was removed by moderation.");
  return d;
}

/** Publish (or resume). Requires an active subscription. Returns whether the deal is live right now. */
export async function publishDeal(db: Db, userId: string, dealId: string) {
  const d = await loadOwnedDeal(db, userId, dealId);
  await assertCanPublish(db, d.business_id);
  if (d.status === "ended") throw new DomainError("ended", "This deal has ended. Duplicate it to run it again.");
  const [timing] = await db.query<{ ended: boolean; live: boolean }>(
    `select ends_at <= now() as ended, starts_at <= now() as live from public.deals where id = $1`,
    [dealId],
  );
  if (timing!.ended) throw new DomainError("invalid", "The end time is in the past. Update it before publishing.");
  if (d.type === "appointment") {
    const [slot] = await db.query(`select 1 from public.appointment_slots where deal_id = $1 and starts_at > now() limit 1`, [dealId]);
    if (!slot) throw new DomainError("invalid", "Add at least one upcoming time slot before publishing.");
  }
  await db.query(
    `update public.deals set status = 'published', published_at = coalesce(published_at, now()) where id = $1`,
    [dealId],
  );
  await audit(db, userId, d.status === "paused" ? "deal.resumed" : "deal.published", "deal", dealId);
  return { live: timing!.live, businessId: d.business_id as string };
}

export async function pauseDeal(db: Db, userId: string, dealId: string) {
  const d = await loadOwnedDeal(db, userId, dealId);
  if (d.status !== "published") throw new DomainError("invalid", "Only published deals can be paused.");
  await db.query(`update public.deals set status = 'paused' where id = $1`, [dealId]);
  await audit(db, userId, "deal.paused", "deal", dealId);
}

/** End now. Vouchers already issued remain valid until their own expiry. */
export async function endDeal(db: Db, userId: string, dealId: string) {
  const d = await loadOwnedDeal(db, userId, dealId);
  if (d.status === "draft") throw new DomainError("invalid", "Drafts can be deleted instead.");
  await db.query(`update public.deals set status = 'ended' where id = $1`, [dealId]);
  await audit(db, userId, "deal.ended", "deal", dealId);
}

export async function deleteDraft(db: Db, userId: string, dealId: string) {
  const d = await loadOwnedDeal(db, userId, dealId);
  if (d.status !== "draft" || d.claimed_count > 0) throw new DomainError("invalid", "Only unpublished drafts can be deleted.");
  await db.query(`delete from public.deals where id = $1`, [dealId]);
  await audit(db, userId, "deal.deleted", "deal", dealId);
}

export async function duplicateDeal(db: Db, userId: string, dealId: string) {
  const d = await loadOwnedDeal(db, userId, dealId);
  const durationMs = Math.min(new Date(d.ends_at).getTime() - new Date(d.starts_at).getTime(), MAX_DEAL_DAYS * 86400000);
  const now = new Date();
  const ends = d.type === "appointment" ? new Date(now.getTime() + 86400000) : new Date(now.getTime() + Math.max(durationMs, 3600000));
  const [row] = await db.query<{ id: string }>(
    `insert into public.deals (business_id, type, title, description, images, discount_kind, original_price_cents,
       deal_price_cents, percent_off, amount_off_cents, quantity_total, per_customer_limit, starts_at, ends_at,
       redemption_instructions, restrictions, duration_minutes, recurring_days, window_start, window_end, created_by, duplicated_from)
     select business_id, type, title, description, images, discount_kind, original_price_cents, deal_price_cents, percent_off,
       amount_off_cents, quantity_total, per_customer_limit, $3::timestamptz, $4::timestamptz, redemption_instructions,
       restrictions, duration_minutes, recurring_days, window_start, window_end, $2, id
     from public.deals where id = $1 returning id`,
    [dealId, userId, now.toISOString(), ends.toISOString()],
  );
  await audit(db, userId, "deal.duplicated", "deal", row!.id, { from: dealId });
  return { id: row!.id };
}

// ---------------------------------------------------------------------------
// Dashboard & analytics
// ---------------------------------------------------------------------------
export async function getOverview(q: Queryable, businessId: string) {
  const [s] = await q.query(
    `select
       (select count(*)::int from public.deals d join public.businesses b on b.id = d.business_id
          where d.business_id = $1 and d.status = 'published' and d.moderation_removed_at is null
          and d.starts_at <= now() and d.ends_at > now()) as active_deals,
       (select count(*)::int from public.claims where business_id = $1) as total_claims,
       (select count(*)::int from public.redemptions where business_id = $1) as redemptions,
       (select count(*)::int from public.follows where business_id = $1) as followers,
       (select coalesce(sum(final_amount_cents), 0)::int from public.redemptions where business_id = $1) as revenue_cents,
       (select count(*)::int from public.deals where business_id = $1 and status = 'draft') as drafts`,
    [businessId],
  );
  const activity = await q.query<{ kind: string; at: Date; title: string; who: string | null; amount: number | null }>(
    `select * from (
       select 'claim' as kind, c.created_at as at, c.terms ->> 'title' as title, p.full_name as who, null::int as amount
         from public.claims c join public.profiles p on p.id = c.user_id where c.business_id = $1
       union all
       select 'redemption', r.redeemed_at, c.terms ->> 'title', p.full_name, r.final_amount_cents
         from public.redemptions r join public.claims c on c.id = r.claim_id join public.profiles p on p.id = r.user_id
         where r.business_id = $1
       union all
       select 'follow', f.created_at, null, p.full_name, null
         from public.follows f join public.profiles p on p.id = f.user_id where f.business_id = $1
     ) a order by at desc limit 12`,
    [businessId],
  );
  return { stats: s as Record<string, number>, activity };
}

export type Range = "7d" | "30d" | "90d" | "all";
const RANGE_DAYS: Record<Range, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

export async function getAnalytics(q: Queryable, businessId: string, range: Range) {
  const days = RANGE_DAYS[range] ?? null;
  const since = days ? `now() - interval '${days} days'` : `'-infinity'::timestamptz`;
  const [totals] = await q.query(
    `select
       (select count(*)::int from public.claims where business_id = $1 and created_at > ${since}) as claims,
       (select count(*)::int from public.redemptions where business_id = $1 and redeemed_at > ${since}) as redemptions,
       (select coalesce(sum(final_amount_cents),0)::int from public.redemptions where business_id = $1 and redeemed_at > ${since}) as revenue_cents,
       (select coalesce(sum(savings_cents),0)::int from public.redemptions where business_id = $1 and redeemed_at > ${since}) as customer_savings_cents,
       (select count(*)::int from public.follows where business_id = $1 and created_at > ${since}) as new_followers,
       (select count(*)::int from public.deals where business_id = $1 and status = 'published' and moderation_removed_at is null
          and starts_at <= now() and ends_at > now()) as active_offers`,
    [businessId],
  );
  const chartDays = days ?? 90;
  const daily = await q.query<{ day: string; claims: number; redemptions: number }>(
    `with tz as (select timezone as zone from public.businesses where id = $1),
     days as (
       select generate_series((now() at time zone tz.zone)::date - ($2::int - 1), (now() at time zone tz.zone)::date, '1 day')::date as day from tz
     )
     select to_char(days.day, 'YYYY-MM-DD') as day,
       (select count(*)::int from public.claims c where c.business_id = $1 and (c.created_at at time zone (select zone from tz))::date = days.day) as claims,
       (select count(*)::int from public.redemptions r where r.business_id = $1 and (r.redeemed_at at time zone (select zone from tz))::date = days.day) as redemptions
     from days order by days.day`,
    [businessId, chartDays],
  );
  const byOffer = await q.query<{ id: string; title: string; type: string; claims: number; redemptions: number; revenue_cents: number; state: string }>(
    `select d.id, d.title, d.type, ${STATE_SQL} as state,
       (select count(*)::int from public.claims c where c.deal_id = d.id and c.created_at > ${since}) as claims,
       (select count(*)::int from public.redemptions r where r.deal_id = d.id and r.redeemed_at > ${since}) as redemptions,
       (select coalesce(sum(final_amount_cents),0)::int from public.redemptions r where r.deal_id = d.id and r.redeemed_at > ${since}) as revenue_cents
     from public.deals d where d.business_id = $1 and d.status <> 'draft'
     order by redemptions desc, claims desc limit 50`,
    [businessId],
  );
  return { totals: totals as Record<string, number>, daily, byOffer };
}

export async function listFollowers(q: Queryable, businessId: string) {
  return q.query<{ full_name: string | null; created_at: Date; notify: boolean }>(
    `select p.full_name, f.created_at, f.notify from public.follows f join public.profiles p on p.id = f.user_id
     where f.business_id = $1 order by f.created_at desc limit 500`,
    [businessId],
  );
}

export async function getMerchantBusiness(q: Queryable, businessId: string) {
  const [b] = await q.query(`select * from public.businesses where id = $1`, [businessId]);
  return b ?? null;
}

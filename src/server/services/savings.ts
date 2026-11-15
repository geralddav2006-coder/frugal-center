import type { Queryable } from "../db/types";
import { generateToken } from "./common";
import { MARKET_TZ } from "@/lib/time";

export interface SavingsSummary {
  totalCents: number;
  monthCents: number;
  count: number;
  avgCents: number;
  firstRedemptionAt: Date | null;
  monthly: { month: string; cents: number; count: number }[];
  items: {
    id: string;
    business_name: string;
    business_slug: string;
    title: string;
    savings_cents: number;
    final_amount_cents: number;
    original_amount_cents: number;
    redeemed_at: Date;
  }[];
}

const TZ = MARKET_TZ;

/**
 * Savings come exclusively from `redemptions` — rows written at the moment a
 * merchant confirms a voucher. Claimed-but-unredeemed vouchers never count,
 * and later edits to a deal can't change history.
 */
export async function getSavingsSummary(q: Queryable, userId: string): Promise<SavingsSummary> {
  const [totals] = await q.query(
    `select coalesce(sum(savings_cents), 0)::int as total,
            coalesce(sum(savings_cents) filter (
              where date_trunc('month', redeemed_at at time zone $2) = date_trunc('month', now() at time zone $2)
            ), 0)::int as month,
            count(*)::int as n,
            min(redeemed_at) as first_at
     from public.redemptions where user_id = $1`,
    [userId, TZ],
  );
  const monthly = await q.query<{ month: string; cents: number; count: number }>(
    `with months as (
       select generate_series(date_trunc('month', now() at time zone $2) - interval '5 months',
                              date_trunc('month', now() at time zone $2), interval '1 month') as m
     )
     select to_char(months.m, 'YYYY-MM') as month,
            coalesce(sum(r.savings_cents), 0)::int as cents, count(r.id)::int as count
     from months left join public.redemptions r
       on r.user_id = $1 and date_trunc('month', r.redeemed_at at time zone $2) = months.m
     group by months.m order by months.m`,
    [userId, TZ],
  );
  const items = await q.query<SavingsSummary["items"][number]>(
    `select r.id, b.name as business_name, b.slug as business_slug, c.terms ->> 'title' as title,
            r.savings_cents, r.final_amount_cents, r.original_amount_cents, r.redeemed_at
     from public.redemptions r
     join public.claims c on c.id = r.claim_id
     join public.businesses b on b.id = r.business_id
     where r.user_id = $1 order by r.redeemed_at desc limit 200`,
    [userId],
  );
  const total = totals!.total as number;
  const n = totals!.n as number;
  return {
    totalCents: total,
    monthCents: totals!.month,
    count: n,
    avgCents: n ? Math.round(total / n) : 0,
    firstRedemptionAt: totals!.first_at,
    monthly,
    items,
  };
}

export async function enableSavingsShare(q: Queryable, userId: string) {
  const [row] = await q.query<{ share_token: string }>(
    `update public.profiles set share_token = coalesce(share_token, $2) where id = $1 returning share_token`,
    [userId, generateToken(12)],
  );
  return row!.share_token;
}

export async function disableSavingsShare(q: Queryable, userId: string) {
  await q.query(`update public.profiles set share_token = null where id = $1`, [userId]);
}

/** Public, aggregate-only view. No businesses, dates or amounts per transaction. */
export async function getSharedSavings(q: Queryable, token: string) {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return null;
  const [row] = await q.query<{ first_name: string | null; total: number; n: number; neighborhoods: number }>(
    `select split_part(coalesce(p.full_name, ''), ' ', 1) as first_name,
            coalesce(sum(r.savings_cents), 0)::int as total, count(r.id)::int as n,
            count(distinct r.business_id)::int as neighborhoods
     from public.profiles p left join public.redemptions r on r.user_id = p.id
     where p.share_token = $1 group by p.id`,
    [token],
  );
  return row ? { firstName: row.first_name || "A neighbor", totalCents: row.total, count: row.n, businesses: row.neighborhoods } : null;
}

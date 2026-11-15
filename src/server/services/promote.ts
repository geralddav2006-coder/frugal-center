import type { Queryable } from "../db/types";
import type { DealType } from "@/lib/deals";
import { PROMO_PIECES, type PromoPiece } from "@/lib/promo";

export interface PromoBusiness {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  category_slug: string;
  top_type: DealType | null;
}

/** Business details for signs, plus the deal type it posts most (to pick the default message). */
export async function getPromoBusiness(q: Queryable, businessId: string) {
  const [b] = await q.query<PromoBusiness>(
    `select b.id, b.slug, b.name, b.logo_url, b.category_slug,
       (select d.type::text from public.deals d where d.business_id = b.id and d.status <> 'draft'
        group by d.type order by count(*) desc, max(d.created_at) desc limit 1) as top_type
     from public.businesses b where b.id = $1`,
    [businessId],
  );
  return b ?? null;
}

/** Looks up the business behind a QR code and (optionally) counts the scan. Null if unknown or suspended. */
export async function recordPromoScan(q: Queryable, slug: string, piece: PromoPiece | "other", count: boolean) {
  const [b] = await q.query<{ id: string; slug: string }>(
    `select id, slug from public.businesses where slug = $1 and suspended_at is null`,
    [slug.toLowerCase().slice(0, 60)],
  );
  if (!b) return null;
  if (count) await q.query(`insert into public.promo_scans (business_id, piece) values ($1, $2)`, [b.id, piece]);
  return b;
}

export interface PromoStats {
  scans30: number;
  scansAll: number;
  byPiece30: Record<string, number>;
  signFollowers30: number;
  signFollowersAll: number;
  followers: number;
}

export async function getPromoStats(q: Queryable, businessId: string): Promise<PromoStats> {
  const [row] = await q.query<Omit<PromoStats, "byPiece30">>(
    `select
       (select count(*)::int from public.promo_scans where business_id = $1 and scanned_at > now() - interval '30 days') as "scans30",
       (select count(*)::int from public.promo_scans where business_id = $1) as "scansAll",
       (select count(*)::int from public.follows where business_id = $1 and source = 'sign'
          and created_at > now() - interval '30 days') as "signFollowers30",
       (select count(*)::int from public.follows where business_id = $1 and source = 'sign') as "signFollowersAll",
       (select count(*)::int from public.follows where business_id = $1) as followers`,
    [businessId],
  );
  const pieces = await q.query<{ piece: string; n: number }>(
    `select piece, count(*)::int as n from public.promo_scans
     where business_id = $1 and scanned_at > now() - interval '30 days' group by piece`,
    [businessId],
  );
  const byPiece30: Record<string, number> = Object.fromEntries([...PROMO_PIECES, "other"].map((p) => [p, 0]));
  for (const p of pieces) byPiece30[p.piece] = p.n;
  return { ...row!, byPiece30 };
}

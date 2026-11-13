import type { Db, Queryable } from "../db/types";
import { expectedFinalCents, isWithinWindow, priceDisplay } from "@/lib/deals";
import { formatMoney, privateName } from "@/lib/utils";
import type { ClaimTerms } from "./claims";
import { audit, countRecent, DomainError, extractQrToken, normalizeManualCode, recordEvent } from "./common";

export type RedeemMethod = "qr" | "code";

const FAIL_LIMIT = 10;
const FAIL_WINDOW_S = 600;

export async function requireMember(q: Queryable, userId: string, businessId: string, roles?: string[]) {
  const [m] = await q.query<{ role: string }>(
    `select role from public.business_members where business_id = $1 and user_id = $2`,
    [businessId, userId],
  );
  if (!m || (roles && !roles.includes(m.role))) {
    throw new DomainError("forbidden", "You don't have permission to do that for this business.");
  }
  return m.role as "owner" | "manager" | "staff";
}

export interface VoucherLookup {
  claimId: string;
  status: "active" | "redeemed" | "canceled" | "expired";
  canRedeem: boolean;
  blockReason: string | null;
  terms: ClaimTerms;
  customerName: string;
  claimedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redemption: { original_amount_cents: number; final_amount_cents: number; savings_cents: number } | null;
  requiresAmounts: boolean;
  fixedAmounts: { originalCents: number; finalCents: number } | null;
  priceLabel: string;
}

async function failureKey(businessId: string, staffId: string) {
  return `redeem-fail:${businessId}:${staffId}`;
}

/** Step 1 of both redemption paths: resolve a scanned QR payload or a typed code to a voucher. */
export async function lookupVoucher(
  db: Db,
  args: { staffId: string; businessId: string; method: RedeemMethod; input: string },
): Promise<VoucherLookup> {
  await requireMember(db, args.staffId, args.businessId);
  const key = await failureKey(args.businessId, args.staffId);
  if ((await countRecent(db, key, FAIL_WINDOW_S)) >= FAIL_LIMIT) {
    throw new DomainError("rate_limited", "Too many invalid codes. Please wait 10 minutes and try again.");
  }

  const fail = async (code: string, message: string) => {
    await recordEvent(db, key);
    return new DomainError(code, message);
  };

  let claimRow;
  if (args.method === "qr") {
    const token = extractQrToken(args.input);
    if (!token) throw await fail("invalid", "That QR code isn't a Frugal Center voucher.");
    [claimRow] = await db.query(`select * from public.claims where qr_token = $1`, [token]);
  } else {
    const code = normalizeManualCode(args.input);
    if (!code) {
      throw await fail("invalid_format", "Codes are 8 characters like K7QM-X2PA and never contain 0, 1, I, L or O.");
    }
    [claimRow] = await db.query(`select * from public.claims where code = $1`, [code]);
  }
  if (!claimRow) throw await fail("invalid", "We couldn't find a voucher with that code. Check it and try again.");
  if (claimRow.business_id !== args.businessId) {
    throw await fail("wrong_business", "This voucher belongs to a different business and can't be redeemed here.");
  }
  return describe(db, claimRow.id);
}

async function describe(q: Queryable, claimId: string): Promise<VoucherLookup> {
  const [c] = await q.query(
    `select c.*, (c.expires_at <= now()) as is_expired, p.full_name, d.moderation_removed_at,
            r.original_amount_cents, r.final_amount_cents, r.savings_cents
     from public.claims c
     join public.profiles p on p.id = c.user_id
     join public.deals d on d.id = c.deal_id
     left join public.redemptions r on r.claim_id = c.id
     where c.id = $1`,
    [claimId],
  );
  const terms = c.terms as ClaimTerms;
  const status = c.status === "active" && c.is_expired ? "expired" : c.status;
  const price = priceDisplay(terms);
  let blockReason: string | null = null;
  if (status === "redeemed") blockReason = "This voucher has already been redeemed.";
  else if (status === "canceled") blockReason = "The customer canceled this voucher.";
  else if (status === "expired") blockReason = "This voucher has expired.";
  else if (c.moderation_removed_at) blockReason = "This deal was removed by Frugal Center moderation.";
  else if (terms.type === "slow_hours" && !isWithinWindow(terms, terms.timezone)) {
    blockReason = "This offer is only valid during its scheduled days and hours.";
  }
  return {
    claimId: c.id,
    status,
    canRedeem: !blockReason,
    blockReason,
    terms,
    customerName: privateName(c.full_name),
    claimedAt: c.created_at,
    expiresAt: c.expires_at,
    redeemedAt: c.redeemed_at,
    redemption: c.savings_cents != null
      ? { original_amount_cents: c.original_amount_cents, final_amount_cents: c.final_amount_cents, savings_cents: c.savings_cents }
      : null,
    requiresAmounts: price.variable,
    fixedAmounts: price.variable
      ? null
      : { originalCents: terms.original_price_cents!, finalCents: terms.deal_price_cents! },
    priceLabel: price.variable ? price.headline : `${price.headline} (reg. ${price.original})`,
  };
}

export interface RedemptionResult {
  redemptionId: string;
  savingsCents: number;
  originalCents: number;
  finalCents: number;
  redeemedAt: Date;
  title: string;
}

/** Step 2: staff confirms. Atomic — a voucher can only ever be redeemed once. */
export async function confirmRedemption(
  db: Db,
  args: {
    staffId: string;
    businessId: string;
    claimId: string;
    method: RedeemMethod;
    originalCents?: number | null;
    finalCents?: number | null;
  },
): Promise<RedemptionResult> {
  await requireMember(db, args.staffId, args.businessId);
  return db.tx(async (q) => {
    const [c] = await q.query(
      `select c.*, (c.expires_at <= now()) as is_expired, d.moderation_removed_at
       from public.claims c join public.deals d on d.id = c.deal_id
       where c.id = $1 for update of c`,
      [args.claimId],
    );
    if (!c) throw new DomainError("invalid", "Voucher not found.");
    if (c.business_id !== args.businessId) {
      throw new DomainError("wrong_business", "This voucher belongs to a different business.");
    }
    if (c.status === "redeemed") throw new DomainError("already_redeemed", "This voucher has already been redeemed.");
    if (c.status === "canceled") throw new DomainError("canceled", "The customer canceled this voucher.");
    if (c.is_expired) throw new DomainError("expired", "This voucher has expired.");
    if (c.moderation_removed_at) throw new DomainError("removed", "This deal was removed by moderation.");
    const terms = c.terms as ClaimTerms;
    if (terms.type === "slow_hours" && !isWithinWindow(terms, terms.timezone)) {
      throw new DomainError("outside_window", "This offer is only valid during its scheduled days and hours.");
    }

    let originalCents: number;
    let finalCents: number;
    const variable = priceDisplay(terms).variable;
    if (!variable) {
      // Fixed-price deal: amounts come from the frozen terms, never from the client.
      originalCents = terms.original_price_cents!;
      finalCents = terms.deal_price_cents!;
    } else {
      const o = args.originalCents;
      if (o == null || !Number.isInteger(o) || o <= 0 || o > 10_000_000) {
        throw new DomainError("amounts_required", "Enter the customer's bill total before the discount.");
      }
      const f = args.finalCents ?? expectedFinalCents(terms, o);
      if (!Number.isInteger(f) || f < 0 || f > o) {
        throw new DomainError("amounts_invalid", "The discounted total must be between $0 and the original total.");
      }
      originalCents = o;
      finalCents = f;
    }

    const updated = await q.query(
      `update public.claims set status = 'redeemed', redeemed_at = now()
       where id = $1 and status = 'active' returning redeemed_at`,
      [c.id],
    );
    if (!updated.length) throw new DomainError("already_redeemed", "This voucher has already been redeemed.");

    const [r] = await q.query<{ id: string; savings_cents: number; redeemed_at: Date }>(
      `insert into public.redemptions (claim_id, business_id, deal_id, user_id, redeemed_by, method,
         original_amount_cents, final_amount_cents, amounts_confirmed_by_merchant)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id, savings_cents, redeemed_at`,
      [c.id, c.business_id, c.deal_id, c.user_id, args.staffId, args.method, originalCents, finalCents, variable],
    );

    if (r!.savings_cents > 0) {
      await q.query(
        `insert into public.notifications (user_id, type, title, body, url, business_id, deal_id)
         values ($1, 'voucher_redeemed', $2, $3, '/savings', $4, $5)
         on conflict do nothing`,
        [
          c.user_id,
          `You saved ${formatMoney(r!.savings_cents)}`,
          `${terms.title} at ${terms.business_name} was redeemed.`,
          c.business_id,
          c.deal_id,
        ],
      );
    }
    await audit(q, args.staffId, "voucher.redeemed", "claim", c.id, {
      method: args.method,
      savings_cents: r!.savings_cents,
    });
    return {
      redemptionId: r!.id,
      savingsCents: r!.savings_cents,
      originalCents,
      finalCents,
      redeemedAt: r!.redeemed_at,
      title: terms.title,
    };
  });
}

export async function recentRedemptions(q: Queryable, businessId: string, limit = 10) {
  return q.query(
    `select r.id, r.redeemed_at, r.method, r.savings_cents, r.final_amount_cents, c.terms ->> 'title' as title,
            p.full_name
     from public.redemptions r join public.claims c on c.id = r.claim_id join public.profiles p on p.id = r.user_id
     where r.business_id = $1 order by r.redeemed_at desc limit $2`,
    [businessId, limit],
  );
}

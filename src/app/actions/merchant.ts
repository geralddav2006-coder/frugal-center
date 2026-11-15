"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { getActiveMembership, getViewer, setActiveBusiness } from "@/server/auth";
import { run, requireSignedIn } from "@/server/action";
import { DomainError } from "@/server/services/common";
import { uploadImage } from "@/server/storage";
import {
  createBusiness,
  deleteDraft,
  duplicateDeal,
  endDeal,
  inviteTeamMember,
  pauseDeal,
  publishDeal,
  removeTeamMember,
  revokeInvite,
  saveDeal,
  updateBusiness,
} from "@/server/services/merchant";
import type { BusinessInput, DealInput } from "@/server/services/schemas";
import { confirmRedemption, lookupVoucher, requireMember, type RedeemMethod } from "@/server/services/redemption";
import { dispatchNewDeal } from "@/server/services/notify";
import {
  activateDemoSubscription,
  cancelDemoSubscription,
  createCheckoutSession,
  createPortalSession,
} from "@/server/services/billing";

async function ctx(roles?: ("owner" | "manager" | "staff")[]) {
  const viewer = requireSignedIn(await getViewer());
  const membership = await getActiveMembership(viewer);
  if (!membership) throw new DomainError("no_business", "Set up your business first.");
  const db = await getDb();
  if (roles) await requireMember(db, viewer.id, membership.business_id, roles);
  return { viewer, membership, db, businessId: membership.business_id };
}

function announce(dealId: string) {
  after(async () => {
    try {
      await dispatchNewDeal(await getDb(), dealId);
    } catch (err) {
      console.error("[notify] dispatch failed", err);
    }
  });
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------
export async function createBusinessAction(input: BusinessInput) {
  const res = await run(async () => {
    const viewer = requireSignedIn(await getViewer());
    const biz = await createBusiness(await getDb(), viewer.id, input);
    await setActiveBusiness(biz.id);
    return biz;
  });
  if (res.ok) {
    revalidatePath("/", "layout");
    redirect("/dashboard/billing?welcome=1");
  }
  return res;
}

export async function updateBusinessAction(input: BusinessInput) {
  return run(async () => {
    const { viewer, db, businessId } = await ctx(["owner", "manager"]);
    await updateBusiness(db, viewer.id, businessId, input);
    revalidatePath("/", "layout");
    return {};
  });
}

export async function uploadImageAction(form: FormData) {
  return run(async () => {
    const viewer = requireSignedIn(await getViewer());
    const db = await getDb();
    const folder = String(form.get("folder"));
    if (!["logos", "covers", "deals"].includes(folder)) throw new DomainError("invalid", "Invalid upload.");
    // Before a business exists (onboarding) only logo/cover uploads are allowed.
    if (folder === "deals" && !viewer.memberships.length) throw new DomainError("forbidden", "Set up your business first.");
    const { rateLimit } = await import("@/server/services/common");
    if (!(await rateLimit(db, `upload:${viewer.id}`, 40, 3600))) throw new DomainError("rate_limited", "Too many uploads. Try again later.");
    const url = await uploadImage(form.get("file") as File, folder as "logos" | "covers" | "deals");
    return { url };
  });
}

export async function switchBusinessAction(businessId: string) {
  const viewer = requireSignedIn(await getViewer());
  if (viewer.memberships.some((m) => m.business_id === businessId)) await setActiveBusiness(businessId);
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export async function saveDealAction(input: DealInput, dealId: string | null, intent: "draft" | "publish") {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx(["owner", "manager"]);
    const { id } = await saveDeal(db, viewer.id, businessId, input, dealId ?? undefined);
    if (intent === "publish") {
      try {
        const r = await publishDeal(db, viewer.id, id);
        if (r.live) announce(id);
        return { id, published: true, live: r.live, publishError: null as string | null };
      } catch (err) {
        if (err instanceof DomainError) return { id, published: false, live: false, publishError: err.message };
        throw err;
      }
    }
    return { id, published: false, live: false, publishError: null as string | null };
  });
  revalidatePath("/dashboard", "layout");
  return res;
}

export async function dealLifecycleAction(dealId: string, op: "publish" | "pause" | "end" | "duplicate" | "delete") {
  const res = await run(async () => {
    const { viewer, db } = await ctx(["owner", "manager"]);
    switch (op) {
      case "publish": {
        const r = await publishDeal(db, viewer.id, dealId);
        if (r.live) announce(dealId);
        return { id: dealId, live: r.live };
      }
      case "pause":
        await pauseDeal(db, viewer.id, dealId);
        return { id: dealId, live: false };
      case "end":
        await endDeal(db, viewer.id, dealId);
        return { id: dealId, live: false };
      case "duplicate":
        return { ...(await duplicateDeal(db, viewer.id, dealId)), live: false };
      case "delete":
        await deleteDraft(db, viewer.id, dealId);
        return { id: dealId, live: false };
    }
  });
  revalidatePath("/", "layout");
  if (res.ok && op === "duplicate") redirect(`/dashboard/deals/${res.id}?duplicated=1`);
  if (res.ok && op === "delete") redirect(`/dashboard/deals`);
  return res;
}

// ---------------------------------------------------------------------------
// Redemption — both QR and manual code use exactly these two actions
// ---------------------------------------------------------------------------
export async function lookupVoucherAction(method: RedeemMethod, input: string) {
  return run(async () => {
    const { viewer, db, businessId } = await ctx();
    const v = await lookupVoucher(db, { staffId: viewer.id, businessId, method, input: String(input).slice(0, 300) });
    return { voucher: v };
  });
}

export async function confirmRedemptionAction(args: {
  claimId: string;
  method: RedeemMethod;
  originalCents?: number | null;
  finalCents?: number | null;
}) {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx();
    return confirmRedemption(db, { staffId: viewer.id, businessId, ...args });
  });
  revalidatePath("/dashboard", "layout");
  return res;
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export async function inviteTeamAction(email: string, role: "manager" | "staff") {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx(["owner", "manager"]);
    return inviteTeamMember(db, viewer.id, businessId, email, role);
  });
  revalidatePath("/dashboard/profile");
  return res;
}

export async function removeTeamAction(userId: string) {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx(["owner", "manager"]);
    await removeTeamMember(db, viewer.id, businessId, userId);
    return {};
  });
  revalidatePath("/dashboard/profile");
  return res;
}

export async function revokeInviteAction(inviteId: string) {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx(["owner", "manager"]);
    await revokeInvite(db, viewer.id, businessId, inviteId);
    return {};
  });
  revalidatePath("/dashboard/profile");
  return res;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export async function startCheckoutAction() {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx(["owner"]);
    return { url: await createCheckoutSession(db, { businessId, userId: viewer.id, email: viewer.email }) };
  });
  if (res.ok) redirect(res.url);
  return res;
}

export async function openBillingPortalAction() {
  const res = await run(async () => {
    const { db, businessId } = await ctx(["owner"]);
    return { url: await createPortalSession(db, businessId) };
  });
  if (res.ok) redirect(res.url);
  return res;
}

export async function demoSubscriptionAction(active: boolean) {
  const res = await run(async () => {
    const { viewer, db, businessId } = await ctx(["owner"]);
    if (active) await activateDemoSubscription(db, businessId, viewer.id);
    else await cancelDemoSubscription(db, businessId, viewer.id);
    return {};
  });
  revalidatePath("/dashboard", "layout");
  return res;
}

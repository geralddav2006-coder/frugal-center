"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { getViewer } from "@/server/auth";
import { run, requireSignedIn } from "@/server/action";
import { DomainError } from "@/server/services/common";
import { assertAdmin, resolveReport, reviewBusiness, setBusinessSuspended, setDealRemoved } from "@/server/services/admin";
import { isDemo } from "@/server/env";

async function admin() {
  const v = requireSignedIn(await getViewer());
  const db = await getDb();
  await assertAdmin(db, v.id); // re-checked against the database on every action
  return { v, db };
}

export async function reviewBusinessAction(businessId: string, decision: "approved" | "rejected") {
  const res = await run(async () => {
    const { v, db } = await admin();
    await reviewBusiness(db, v.id, businessId, decision);
    return {};
  });
  revalidatePath("/admin", "layout");
  return res;
}

export async function suspendBusinessAction(businessId: string, suspended: boolean, reason?: string) {
  const res = await run(async () => {
    const { v, db } = await admin();
    await setBusinessSuspended(db, v.id, businessId, suspended, reason);
    return {};
  });
  revalidatePath("/", "layout");
  return res;
}

export async function removeDealAction(dealId: string, removed: boolean, note?: string) {
  const res = await run(async () => {
    const { v, db } = await admin();
    await setDealRemoved(db, v.id, dealId, removed, note);
    return {};
  });
  revalidatePath("/", "layout");
  return res;
}

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed") {
  const res = await run(async () => {
    const { v, db } = await admin();
    await resolveReport(db, v.id, reportId, status);
    return {};
  });
  revalidatePath("/admin", "layout");
  return res;
}

export async function resetDemoAction() {
  const res = await run(async () => {
    if (!isDemo) throw new DomainError("forbidden", "Only available in local demo mode.");
    const { db } = await admin();
    const { resetDemoData } = await import("@/server/db/seed");
    await resetDemoData(db);
    return {};
  });
  revalidatePath("/", "layout");
  return res;
}

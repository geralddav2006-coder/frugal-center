import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { dispatchDueDeals } from "@/server/services/notify";

/** Vercel Cron: announces scheduled deals whose start time has arrived. */
export async function GET(req: NextRequest) {
  const expected = env.cronSecret ? Buffer.from(`Bearer ${env.cronSecret}`) : null;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  if (!expected || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const results = await dispatchDueDeals(db);
  // Housekeeping: rate-limit events older than a day are no longer needed.
  await db.query(`delete from public.rate_limit_events where created_at < now() - interval '2 days'`);
  return NextResponse.json({ dispatched: results.length, results });
}

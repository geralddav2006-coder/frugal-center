import "server-only";
import { after } from "next/server";
import { getDb } from "./db";

let lastSweep = 0;

/**
 * Opportunistic, throttled sweep that announces scheduled deals whose start
 * time has passed. Production also runs it from Vercel Cron (/api/cron/dispatch);
 * this keeps the local demo (no cron) behaving the same way.
 */
export function scheduleDueDispatch() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  after(async () => {
    const { dispatchDueDeals } = await import("./services/notify");
    try {
      await dispatchDueDeals(await getDb());
    } catch (err) {
      console.error("[notify] sweep failed", err);
    }
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { env, integrations, isDemo } from "@/server/env";

export const dynamic = "force-dynamic";

const withTimeout = async <T,>(label: string, ms: number, fn: () => Promise<T>) => {
  const t0 = Date.now();
  try {
    const value = await Promise.race([fn(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))]);
    return { step: label, ok: true, ms: Date.now() - t0, value };
  } catch (err) {
    return { step: label, ok: false, ms: Date.now() - t0, error: (err as Error).message.slice(0, 200) };
  }
};

/**
 * Setup check for the live site. Reports which services are configured — never any values.
 * `?check=1` also times a database write and a call to Supabase Auth.
 */
export async function GET(req: NextRequest) {
  let database: "ok" | "error" = "error";
  let migrations: number | null = null;
  let launchAreas: number | null = null;
  try {
    const db = await getDb();
    const [row] = await db.query<{ n: number }>(`select count(*)::int as n from public.launch_areas`);
    launchAreas = row?.n ?? 0;
    database = "ok";
    if (!isDemo) {
      const [m] = await db.query<{ n: number }>(`select count(*)::int as n from fc_meta.migrations`);
      migrations = m?.n ?? 0;
    }
  } catch {
    database = "error";
  }
  const checks = [];
  if (req.nextUrl.searchParams.get("check") === "1") {
    const db = await getDb().catch(() => null);
    if (db) {
      checks.push(await withTimeout("db query with parameters", 8000, async () => {
        const [r] = await db.query<{ n: number }>(
          `select count(*)::int as n from public.rate_limit_events where key = $1 and created_at > now() - make_interval(secs => $2)`,
          ["health-check", 60],
        );
        return r?.n;
      }));
      checks.push(await withTimeout("db 8 parallel queries", 8000, async () => {
        const rows = await Promise.all(Array.from({ length: 8 }, (_, i) => db.query<{ n: number }>(`select $1::int as n, pg_sleep(0.05)`, [i])));
        return rows.map((r) => r[0]?.n).join(",");
      }));
      checks.push(await withTimeout("db write", 8000, async () => {
        await db.query(`insert into public.rate_limit_events (key) values ($1)`, ["health-check"]);
        await db.query(`delete from public.rate_limit_events where key = $1`, ["health-check"]);
        return "ok";
      }));
    }
    if (integrations.supabase) {
      checks.push(await withTimeout("supabase auth reachable", 8000, async () => {
        const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, { headers: { apikey: env.supabaseAnonKey! }, cache: "no-store" });
        return res.status;
      }));
    }
  }
  return NextResponse.json(
    {
      mode: isDemo ? "local-demo" : "live",
      appUrl: env.appUrl,
      database,
      migrations,
      launchAreas,
      supabase: integrations.supabase,
      supabaseHost: env.supabaseUrl ? new URL(env.supabaseUrl).host : null,
      dbPort: env.databaseUrl ? (new URL(env.databaseUrl).port || "5432") : null,
      dbPooler: env.databaseUrl ? ((new URL(env.databaseUrl).port || "5432") === "6543" ? "transaction" : "session or direct") : null,
      stripe: integrations.stripe,
      email: integrations.resend,
      push: integrations.push,
      cronSecret: Boolean(env.cronSecret),
      admins: env.adminEmails.length,
      ...(checks.length ? { checks } : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

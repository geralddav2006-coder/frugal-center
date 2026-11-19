import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { env, integrations, isDemo } from "@/server/env";

export const dynamic = "force-dynamic";

/** Setup check for the live site. Reports which services are configured — never any values. */
export async function GET() {
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
  return NextResponse.json(
    {
      mode: isDemo ? "local-demo" : "live",
      appUrl: env.appUrl,
      database,
      migrations,
      launchAreas,
      supabase: integrations.supabase,
      stripe: integrations.stripe,
      email: integrations.resend,
      push: integrations.push,
      cronSecret: Boolean(env.cronSecret),
      admins: env.adminEmails.length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

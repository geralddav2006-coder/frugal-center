/**
 * Seed sample data into a Supabase project (or the local demo DB).
 *   npm run db:seed
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL for Supabase.
 * Only run against a development/staging project: it creates demo users and businesses.
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { seedDemoData, DEMO_PASSWORD } from "../src/server/db/seed";
import type { Db } from "../src/server/db/types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!url || !service || !dbUrl) {
    console.log("Supabase env not set — the local demo database seeds itself automatically on first start (npm run dev).");
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.FC_ALLOW_PROD_SEED !== "1") {
    throw new Error("Refusing to seed in production. Set FC_ALLOW_PROD_SEED=1 if you really mean it.");
  }
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const db: Db = {
    query: (t, p) => sql.unsafe(t, (p ?? []) as never[]) as never,
    tx: (fn) => sql.begin((tx) => fn({ query: (t, p) => tx.unsafe(t, (p ?? []) as never[]) as never })) as never,
  };
  const [{ n }] = await sql`select count(*)::int as n from public.businesses`;
  if (n > 0) {
    console.log(`Database already has ${n} businesses; skipping seed.`);
    await sql.end();
    return;
  }
  const sb = createClient(url, service, { auth: { persistSession: false } });
  await seedDemoData(db, async (email, password, fullName) => {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw error;
    return data.user.id;
  });
  console.log(`Seeded. Demo accounts use password "${DEMO_PASSWORD}".`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

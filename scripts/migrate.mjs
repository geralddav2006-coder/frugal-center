// Applies supabase/migrations/*.sql to the production database, once each, in order.
// Runs automatically on Vercel before the build (npm run vercel-build). Safe to re-run.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const e = process.env;
const raw = e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_URL;
if (!raw) {
  console.log("[migrate] No database configured; skipping (local demo mode migrates itself).");
  process.exit(0);
}
const u = new URL(raw);
u.search = "";
const local = ["localhost", "127.0.0.1"].includes(u.hostname);
const sql = postgres(u.toString(), { prepare: false, max: 1, onnotice: () => {}, ...(local ? {} : { ssl: "require" }) });

const dir = path.join(process.cwd(), "supabase", "migrations");
try {
  await sql.unsafe(`create schema if not exists fc_meta;
    create table if not exists fc_meta.migrations (name text primary key, applied_at timestamptz not null default now());`);
  const done = new Set((await sql`select name from fc_meta.migrations`).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const text = readFileSync(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into fc_meta.migrations (name) values (${file})`;
    });
    console.log(`[migrate] applied ${file}`);
    applied++;
  }
  console.log(`[migrate] ${applied ? `${applied} applied` : "up to date"} (${files.length} total)`);
} catch (err) {
  console.error("[migrate] failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

// Applies supabase/migrations/*.sql to the production database, once each, in order.
// Runs automatically on Vercel before the build (npm run vercel-build). Safe to re-run.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const e = process.env;
// A direct or session connection is best for schema changes; if it's unavailable (for example
// the session pooler is full), fall back to the transaction pooler.
const candidates = [...new Set([e.DATABASE_URL_UNPOOLED, e.POSTGRES_URL_NON_POOLING, e.DATABASE_URL, e.POSTGRES_URL].filter(Boolean))];
if (!candidates.length) {
  console.log("[migrate] No database configured; skipping (local demo mode migrates itself).");
  process.exit(0);
}
function open(raw) {
  const u = new URL(raw);
  u.search = "";
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  return postgres(u.toString(), { prepare: false, max: 1, max_pipeline: 1, connect_timeout: 15, onnotice: () => {}, ...(local ? {} : { ssl: "require" }) });
}
let sql;
for (const raw of candidates) {
  const attempt = open(raw);
  try {
    await attempt`select 1`;
    sql = attempt;
    break;
  } catch (err) {
    console.warn(`[migrate] couldn't connect on port ${new URL(raw).port || 5432}: ${err.message}`);
    await attempt.end({ timeout: 0 }).catch(() => {});
  }
}
if (!sql) {
  console.error("[migrate] failed: no database connection worked");
  process.exit(1);
}

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

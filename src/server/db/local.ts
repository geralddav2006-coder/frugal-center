import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Db, Queryable } from "./types";

/**
 * Minimal stand-in for the parts of Supabase the migrations rely on:
 * the `auth` schema, `auth.uid()`, and the anon/authenticated roles.
 */
const AUTH_SHIM = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$fn$;
create schema if not exists local_meta;
create table if not exists local_meta.migrations (name text primary key, applied_at timestamptz default now());
`;

export function migrationsDir() {
  return path.join(process.cwd(), "supabase", "migrations");
}

export async function applyMigrations(pg: PGlite) {
  await pg.exec(AUTH_SHIM);
  const applied = new Set(
    (await pg.query<{ name: string }>("select name from local_meta.migrations")).rows.map((r) => r.name),
  );
  const files = readdirSync(migrationsDir()).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir(), file), "utf8");
    await pg.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into local_meta.migrations (name) values ($1)", [file]);
    });
  }
}

export function wrapPglite(pg: PGlite): Db {
  const q = (target: Pick<PGlite, "query">): Queryable => ({
    async query(text, params) {
      const res = await target.query(text, params as unknown[]);
      return res.rows as never;
    },
  });
  return {
    ...q(pg),
    tx: (fn) => pg.transaction((tx) => fn(q(tx as unknown as PGlite))),
  };
}

export async function createLocalDb(dir: string): Promise<{ db: Db; pg: PGlite }> {
  const inMemory = dir.startsWith("memory://");
  if (!inMemory) mkdirSync(dir, { recursive: true });
  const pg = new PGlite(inMemory ? undefined : dir);
  await pg.waitReady;
  await applyMigrations(pg);
  return { db: wrapPglite(pg), pg };
}

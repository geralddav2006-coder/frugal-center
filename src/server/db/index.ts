import "server-only";
import { env, integrations } from "../env";
import type { Db } from "./types";

export type { Db, Queryable, Row } from "./types";

type Holder = { promise?: Promise<Db> };
const g = globalThis as unknown as { __fcDb?: Holder };
const holder: Holder = (g.__fcDb ??= {});

async function connect(): Promise<Db> {
  if (integrations.supabase) {
    const { default: postgres } = await import("postgres");
    // Supabase pooler (transaction mode) does not support prepared statements.
    const sql = postgres(env.databaseUrl!, { prepare: false, max: 5, idle_timeout: 20 });
    return {
      query: (text, params) => sql.unsafe(text, (params ?? []) as never[]) as never,
      tx: (fn) =>
        sql.begin((t) => fn({ query: (text, params) => t.unsafe(text, (params ?? []) as never[]) as never })) as never,
    };
  }
  const { createLocalDb } = await import("./local");
  const { db } = await createLocalDb(env.localDbDir);
  const { ensureDemoSeed } = await import("./seed");
  await ensureDemoSeed(db);
  return db;
}

/** Server-only privileged connection. Callers must authorize first. */
export function getDb(): Promise<Db> {
  holder.promise ??= connect().catch((err) => {
    holder.promise = undefined;
    throw err;
  });
  return holder.promise;
}

/** Test hook: inject an already-initialized database. */
export function setDbForTests(db: Db) {
  holder.promise = Promise.resolve(db);
}

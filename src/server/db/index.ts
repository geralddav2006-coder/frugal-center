import "server-only";
import { env, integrations } from "../env";
import type { Db } from "./types";

export type { Db, Queryable, Row } from "./types";

type Holder = { promise?: Promise<Db> };
const g = globalThis as unknown as { __fcDb?: Holder };
const holder: Holder = (g.__fcDb ??= {});

async function connect(): Promise<Db> {
  if (integrations.supabase) {
    return createPostgresDb(env.databaseUrl!);
  }
  const { createLocalDb } = await import("./local");
  const { db } = await createLocalDb(env.localDbDir);
  const { ensureDemoSeed } = await import("./seed");
  await ensureDemoSeed(db);
  return db;
}

const QUERY_TIMEOUT_MS = 10_000;
const TX_TIMEOUT_MS = 20_000;
const CONNECTION_ERRORS = new Set([
  "FC_DB_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT",
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "57P01", "57P02", "57P03",
]);

function isConnectionError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return !!code && CONNECTION_ERRORS.has(code);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`Database did not respond within ${ms / 1000}s`), { code: "FC_DB_TIMEOUT" })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Postgres client for serverless hosting. Between requests the platform can pause the
 * function, and pooled connections may silently die. Every query gets a time limit; on a
 * dead or timed-out connection the pool is replaced and a plain query is retried once.
 * Transactions are not retried (they may have committed); the next request gets a fresh pool.
 */
export async function createPostgresDb(rawUrl: string, opts: { queryTimeoutMs?: number; txTimeoutMs?: number } = {}): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const queryMs = opts.queryTimeoutMs ?? QUERY_TIMEOUT_MS;
  const txMs = opts.txTimeoutMs ?? TX_TIMEOUT_MS;
  // Supabase's transaction pooler doesn't support prepared statements, and older versions of it
  // hang on pipelined queries, so each connection runs one query at a time (max_pipeline: 1).
  const make = () =>
    postgres(cleanDatabaseUrl(rawUrl), {
      prepare: false, max: 4, max_pipeline: 1, idle_timeout: 5, max_lifetime: 300, connect_timeout: 10, onnotice: () => {}, ...sslFor(rawUrl),
    });
  let sql = make();
  let lastUsed = 0;
  const reset = () => {
    const old = sql;
    sql = make();
    void old.end({ timeout: 0 }).catch(() => {});
  };
  const run = <T>(text: string, params?: unknown[]) => withTimeout(sql.unsafe(text, (params ?? []) as never[]) as unknown as Promise<T[]>, queryMs);
  const query = async <T>(text: string, params?: unknown[]) => {
    try {
      return await run<T>(text, params);
    } catch (err) {
      if (!isConnectionError(err)) throw err;
      reset();
      return await run<T>(text, params);
    } finally {
      lastUsed = Date.now();
    }
  };
  return {
    query,
    async tx(fn) {
      // After a quiet spell, make sure the connection is alive before starting a transaction.
      if (Date.now() - lastUsed > 3000) await query("select 1");
      try {
        return (await withTimeout(
          sql.begin((t) => fn({ query: (text, params) => t.unsafe(text, (params ?? []) as never[]) as never })) as Promise<never>,
          txMs,
        )) as never;
      } catch (err) {
        if (isConnectionError(err)) reset();
        throw err;
      } finally {
        lastUsed = Date.now();
      }
    },
  };
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

/**
 * Integration-provided URLs can carry extra query options (e.g. `supa=`, `pgbouncer=`)
 * that Postgres would reject as startup parameters. Keep the connection, drop those.
 */
export function cleanDatabaseUrl(raw: string) {
  try {
    const u = new URL(raw);
    u.search = "";
    return u.toString();
  } catch {
    return raw;
  }
}

export function sslFor(raw: string): { ssl?: "require" } {
  try {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1" ? {} : { ssl: "require" };
  } catch {
    return {};
  }
}

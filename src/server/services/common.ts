import { randomBytes, randomInt } from "node:crypto";
import type { Queryable } from "../db/types";

/** Expected, user-facing failure. `code` is stable and safe to show/branch on. */
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public meta: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function isUniqueViolation(err: unknown, constraint?: string) {
  const e = err as { code?: string; constraint?: string; constraint_name?: string; message?: string };
  if (e?.code !== "23505") return false;
  if (!constraint) return true;
  return (e.constraint ?? e.constraint_name ?? e.message ?? "").includes(constraint);
}

// Excludes 0/O, 1/I/L to avoid read-aloud and handwriting mistakes.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateManualCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Accepts "k7qm x2pa", "K7QM-X2PA", etc. Returns canonical form or null. */
export function normalizeManualCode(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8) return null;
  if ([...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** QR payload is a deep link (…/dashboard/redeem?t=TOKEN); accept either the URL or a bare token. */
export function extractQrToken(input: string) {
  const trimmed = input.trim();
  let token = trimmed;
  try {
    const url = new URL(trimmed);
    token = url.searchParams.get("t") ?? "";
  } catch {
    /* not a URL */
  }
  return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null;
}

export async function audit(
  q: Queryable,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await q.query(
    `insert into public.audit_log (actor_id, action, entity_type, entity_id, details) values ($1, $2, $3, $4, $5)`,
    [actorId, action, entityType, entityId, JSON.stringify(details)],
  );
}

/**
 * Sliding-window limiter backed by the database (works across serverless
 * instances). Records an event and returns whether the caller is within limit.
 */
export async function rateLimit(q: Queryable, key: string, limit: number, windowSeconds: number) {
  const [row] = await q.query<{ n: number }>(
    `select count(*)::int as n from public.rate_limit_events
     where key = $1 and created_at > now() - make_interval(secs => $2)`,
    [key, windowSeconds],
  );
  if ((row?.n ?? 0) >= limit) return false;
  await q.query(`insert into public.rate_limit_events (key) values ($1)`, [key]);
  return true;
}

export async function countRecent(q: Queryable, key: string, windowSeconds: number) {
  const [row] = await q.query<{ n: number }>(
    `select count(*)::int as n from public.rate_limit_events
     where key = $1 and created_at > now() - make_interval(secs => $2)`,
    [key, windowSeconds],
  );
  return row?.n ?? 0;
}

export async function recordEvent(q: Queryable, key: string) {
  await q.query(`insert into public.rate_limit_events (key) values ($1)`, [key]);
}

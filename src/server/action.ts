import "server-only";
import { unstable_rethrow } from "next/navigation";
import { DomainError } from "./services/common";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string; meta?: Record<string, unknown> };

/** Runs a server action body, turning expected domain errors into friendly results. */
export async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const value = await fn();
    return { ok: true, ...value };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message, code: err.code, meta: err.meta };
    unstable_rethrow(err); // let redirect()/notFound() propagate
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Please try again.", code: "server_error" };
  }
}

export function requireSignedIn<T>(viewer: T | null): T {
  if (!viewer) throw new DomainError("auth_required", "Sign in to continue.");
  return viewer;
}

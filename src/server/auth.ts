import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { Queryable } from "./db/types";
import { env, integrations, sessionSecret } from "./env";
import { DomainError, rateLimit } from "./services/common";
import { listMemberships, type Membership } from "./services/merchant";

const SESSION_COOKIE = "fc_session";
const BUSINESS_COOKIE = "fc_biz";

export interface Viewer {
  id: string;
  email: string;
  fullName: string | null;
  role: "customer" | "admin";
  isAdmin: boolean;
  homeZip: string | null;
  homeLabel: string | null;
  homeLat: number | null;
  homeLng: number | null;
  radius: number;
  memberships: Membership[];
}

// ---------------------------------------------------------------------------
// Local demo auth (only when Supabase is not configured)
// ---------------------------------------------------------------------------
async function setLocalSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function localSessionUserId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function createLocalUser(q: Queryable, email: string, password: string, fullName: string) {
  const hash = await bcrypt.hash(password, 10);
  const [row] = await q.query<{ id: string }>(
    `insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [email.toLowerCase(), hash, JSON.stringify({ full_name: fullName })],
  );
  return row!.id;
}

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}

function validateCredentials(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("invalid", "Enter a valid email address.");
  if (password.length < 8) throw new DomainError("invalid", "Use at least 8 characters for your password.");
  if (password.length > 128) throw new DomainError("invalid", "That password is too long.");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function signUp(input: { email: string; password: string; fullName: string }) {
  const email = input.email.trim().toLowerCase();
  validateCredentials(email, input.password);
  const fullName = input.fullName.trim().slice(0, 80);
  if (fullName.length < 2) throw new DomainError("invalid", "Tell us your name.");
  const db = await getDb();
  if (!(await rateLimit(db, `signup:${await clientKey()}`, Number(process.env.FC_SIGNUP_LIMIT_PER_HOUR) || 10, 3600))) {
    throw new DomainError("rate_limited", "Too many sign-up attempts. Try again later.");
  }

  if (integrations.supabase) {
    const { supabaseServer } = await import("./supabase");
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signUp({
      email,
      password: input.password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${env.appUrl}/auth/callback` },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        throw new DomainError("exists", "An account with that email already exists. Try signing in.");
      }
      throw new DomainError("auth", error.message);
    }
    // Supabase answers a sign-up for an existing email with a placeholder user and no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new DomainError("exists", "An account with that email already exists. Try signing in.");
    }
    return { needsEmailConfirmation: !data.session };
  }

  const [exists] = await db.query(`select 1 from auth.users where email = $1`, [email]);
  if (exists) throw new DomainError("exists", "An account with that email already exists. Try signing in.");
  const id = await createLocalUser(db, email, input.password, fullName);
  await setLocalSession(id);
  return { needsEmailConfirmation: false };
}

export async function signIn(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const db = await getDb();
  if (!(await rateLimit(db, `signin:${await clientKey()}:${email}`, 10, 900))) {
    throw new DomainError("rate_limited", "Too many attempts. Wait 15 minutes and try again.");
  }
  if (integrations.supabase) {
    const { supabaseServer } = await import("./supabase");
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new DomainError("auth", "Incorrect email or password.");
    return;
  }
  const [u] = await db.query<{ id: string; encrypted_password: string | null }>(
    `select id, encrypted_password from auth.users where email = $1`,
    [email],
  );
  // Compare against a dummy hash when the user doesn't exist to keep timing uniform.
  const ok = await bcrypt.compare(password, u?.encrypted_password ?? "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.3pQ7pvCwCHkRVu6g9N1v0wzq2y4K");
  if (!u || !ok) throw new DomainError("auth", "Incorrect email or password.");
  await setLocalSession(u.id);
}

export async function signOut() {
  if (integrations.supabase) {
    const { supabaseServer } = await import("./supabase");
    await (await supabaseServer()).auth.signOut();
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(BUSINESS_COOKIE);
}

async function sessionUserId() {
  if (integrations.supabase) {
    const { supabaseServer } = await import("./supabase");
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user?.id ?? null;
  }
  return localSessionUserId();
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const userId = await sessionUserId();
  if (!userId) return null;
  const db = await getDb();
  const [row] = await db.query(
    `select p.*, u.email from public.profiles p join auth.users u on u.id = p.id where p.id = $1`,
    [userId],
  );
  if (!row) return null;
  // Bootstrap admins from ADMIN_EMAILS (server-side only; users can never set their own role).
  if (row.role !== "admin" && env.adminEmails.includes(String(row.email).toLowerCase())) {
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [userId]);
    row.role = "admin";
  }
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isAdmin: row.role === "admin",
    homeZip: row.home_zip,
    homeLabel: row.home_label,
    homeLat: row.home_lat,
    homeLng: row.home_lng,
    radius: row.search_radius_miles,
    memberships: await listMemberships(db, userId),
  };
});

export async function requireViewer(next = "/"): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v;
}

export async function requireAdmin() {
  const v = await requireViewer("/admin");
  if (!v.isAdmin) redirect("/");
  return v;
}

/** Resolves the business the signed-in staff member is currently working in. */
export async function getActiveMembership(v: Viewer): Promise<Membership | null> {
  if (!v.memberships.length) return null;
  const chosen = (await cookies()).get(BUSINESS_COOKIE)?.value;
  return v.memberships.find((m) => m.business_id === chosen) ?? v.memberships[0]!;
}

export async function requireBusiness(next = "/dashboard", roles?: Membership["role"][]) {
  const viewer = await requireViewer(next);
  const membership = await getActiveMembership(viewer);
  if (!membership) redirect("/for-business/start");
  if (roles && !roles.includes(membership.role)) redirect("/dashboard?denied=1");
  return { viewer, membership };
}

export async function setActiveBusiness(businessId: string) {
  (await cookies()).set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
}

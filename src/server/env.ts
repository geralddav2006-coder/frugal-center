/**
 * Central integration switches. Every external service is optional: when its
 * credentials are missing, Frugal Center runs in a clearly-labelled local demo
 * mode for that service instead of pretending it worked.
 */
import { createHash } from "node:crypto";

const e = process.env;

// Vercel's Supabase integration names some settings differently; accept both.
const vercelUrl = e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
const serviceKey = e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SECRET_KEY;

export const env = {
  appUrl: (e.NEXT_PUBLIC_APP_URL || vercelUrl || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL || e.SUPABASE_URL,
  supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || e.SUPABASE_ANON_KEY || e.SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: serviceKey,
  databaseUrl: e.DATABASE_URL || e.POSTGRES_URL,
  googleAuthEnabled: e.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  // Signs sessions and unsubscribe links. Without AUTH_SECRET, derive one from the Supabase secret key.
  authSecret: e.AUTH_SECRET || (serviceKey ? createHash("sha256").update(`frugal-center-session:${serviceKey}`).digest("base64") : undefined),
  stripeSecretKey: e.STRIPE_SECRET_KEY,
  stripeWebhookSecret: e.STRIPE_WEBHOOK_SECRET,
  stripePriceId: e.STRIPE_PRICE_ID,
  resendApiKey: e.RESEND_API_KEY,
  emailFrom: e.EMAIL_FROM || "Frugal Center <deals@frugal.center>",
  vapidPublicKey: e.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  vapidPrivateKey: e.VAPID_PRIVATE_KEY,
  vapidSubject: e.VAPID_SUBJECT || "mailto:support@frugal.center",
  cronSecret: e.CRON_SECRET,
  localDbDir: e.LOCAL_DB_DIR || ".data/pglite",
  adminEmails: (e.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
};

export const integrations = {
  /** Supabase Auth + Postgres + Storage. Off => local PGlite database and local auth. */
  supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey && env.databaseUrl && env.supabaseServiceRoleKey),
  stripe: Boolean(env.stripeSecretKey && env.stripeWebhookSecret && env.stripePriceId),
  resend: Boolean(env.resendApiKey),
  push: Boolean(env.vapidPublicKey && env.vapidPrivateKey),
};

export const isDemo = !integrations.supabase;

export function sessionSecret(): Uint8Array {
  const secret = env.authSecret;
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production" && !process.env.FC_ALLOW_INSECURE_DEMO_SECRET) {
    throw new Error("AUTH_SECRET (32+ chars) is required in production.");
  }
  return new TextEncoder().encode("frugal-center-local-development-secret-not-for-prod");
}

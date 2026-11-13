/**
 * Central integration switches. Every external service is optional: when its
 * credentials are missing, Frugal Center runs in a clearly-labelled local demo
 * mode for that service instead of pretending it worked.
 */
const e = process.env;

export const env = {
  appUrl: (e.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
  databaseUrl: e.DATABASE_URL,
  googleAuthEnabled: e.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  authSecret: e.AUTH_SECRET,
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

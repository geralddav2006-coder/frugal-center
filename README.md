# Frugal Center

**Good deals, close to home.** A location-based marketplace where local businesses turn surplus inventory, canceled appointments and slow hours into revenue with time-sensitive discounts. Customers discover and claim deals for free; businesses pay a flat **$29/month** with **no commissions**. Customers pay businesses directly. Frugal Center handles discovery, claims, verification, notifications and savings tracking.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix, Lucide, Supabase (Auth, Postgres, Storage), Stripe Billing, Resend and Web Push.

---

## Quick start (local demo, no credentials needed)

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. On first start an embedded Postgres (PGlite) database is created in `.data/`, the same SQL migrations used for Supabase are applied, and realistic sample data for a Dracut, MA launch is seeded.

| Demo account | Email | What to try |
|---|---|---|
| Customer | `maya@demo.frugal.center` | Explore, claim, vouchers, savings ($140.70 history), following |
| Business owner | `owner@demo.frugal.center` | Broadway Bakery dashboard, create/publish deals, redeem, analytics, billing |
| Staff | `staff@demo.frugal.center` | Redeem-only access to Broadway Bakery |
| Admin | `admin@demo.frugal.center` | `/admin`: review, moderation, reports, activity, email log |

Password for all of them: `frugal-demo`. The login page has one-tap buttons for these accounts in demo mode.

**What's real vs. demo in local mode:**

| Feature | Local demo | With credentials |
|---|---|---|
| Auth | Local email/password (bcrypt, signed HttpOnly cookie) | Supabase Auth (+ Google) |
| Database | PGlite (embedded Postgres 18), same migrations + RLS | Supabase Postgres |
| Image uploads | Saved to `.data/uploads`, served by `/api/uploads` | Supabase Storage `media` bucket |
| Billing | "Activate demo plan (no charge)" button, labelled everywhere | Stripe Checkout, webhooks, Customer Portal |
| Email | Recorded in `email_outbox` as `not_configured`, **not sent** | Resend |
| Push | Toggle disabled ("not configured") | Web Push with VAPID keys |

A dismissible banner and the footer state which mode is active. Reset the demo database with `npm run db:reset` (then restart), or use **Reset demo data** in `/admin`.

> Seed photos are hot-linked from Unsplash. If an image can't load, cards fall back to a branded placeholder instead of a broken image.

---

## Feature tour

**Customers**: mobile-first explore page ("Good deals, close to home.") with search, category tabs (All, Food & Drink, Beauty & Wellness, Shopping, Activities, Services, Last-Minute) and four sections: Deals Near You, Ending Soon, Last-Minute Appointments, Businesses You Follow. List or map view (Leaflet + CARTO/OSM tiles with price pins). Filters: distance, category, price, type; sorts: nearest, ending soon, newest, biggest discount. Location by Dracut-area town/ZIP or browser geolocation, with a 3–25 mile radius, with a graceful fallback when permission is denied. Deal pages clearly distinguish **surplus** (quantity + pickup window), **appointments** (pick a specific time slot), **off-peak** (days and hours) and **promotions** (valid between two dates). **Promotions** are a fourth deal type (`promotion`) for general promotional discounts that aren't surplus, appointments or off-peak: percent off, amount off or a special price, valid any time between two dates, with an optional voucher limit. Customers can filter for them with the Promotions type filter. Business profiles at `/business/[slug]`. Follow/unfollow with per-business mute, saved deals, vouchers, history, notification center, preferences, and a savings dashboard with a privacy-safe share link.

**Businesses**: marketing page at `/for-business`, 4-step onboarding (basics, location with map pin, hours, photos), billing, and a dashboard (Overview, My Deals, Create Deal, Redeem, Analytics (with followers), Promote, Profile & Team, Billing). The deal editor supports all four types with a live preview, plus save draft, publish now, schedule (future start), pause/resume, end, duplicate and delete draft. Redemption has **Scan QR** (live camera) and **Enter Code** tabs that share one verification path. Team roles: owner, manager, staff. **Promote** (`/dashboard/promote`) gives each business printable in-store signs (counter card, table tent, window sign, sticker sheet) with their own QR code, a message picker based on the deals they run, a share link and a downloadable QR PNG. Codes point to `/f/<slug>?p=<piece>`, which counts the scan and opens the business page with a one-tap follow (new visitors sign up and are followed automatically); follows from a sign are credited (`follows.source = 'sign'`) and shown on the Promote page.

**Admin** (`/admin`): platform stats, business review (approve/reject), suspension, listing moderation (disable/restore), abuse reports, subscription status, claims and redemptions monitor, audit log, email log.

---

## Architecture

```
src/
  app/
    (market)/        customer pages: explore, deals, business, vouchers, savings, …
    (auth)/          login / signup
    for-business/    business landing + onboarding
    dashboard/       merchant dashboard
    admin/           platform admin
    actions/         server actions (auth → authorize → validate → service)
    api/             stripe webhook, cron, uploads, unsubscribe
  server/
    db/              Postgres adapter (postgres.js for Supabase | PGlite locally), seed
    services/        domain logic: discovery, claims, redemption, savings, notify,
                     merchant, billing, engagement, admin (no Next.js imports → unit-testable)
    auth.ts          session (Supabase Auth or local), viewer, role guards
  components/        UI primitives (ui/), deals, merchant, charts, layout
  lib/               shared pure helpers (pricing, time zones, formatting)
supabase/migrations/ schema, RLS, storage bucket
tests/unit/          vitest: domain flows, concurrency and RLS against real Postgres (PGlite)
tests/e2e/run.mjs    Playwright: full customer ↔ merchant flow through the UI
```

Every page renders per request (vouchers, countdowns and capacity are time- and user-dependent) and streams through `loading.tsx` skeletons. `cacheComponents` is intentionally off.

### Data model

`profiles`, `notification_preferences`, `businesses`, `business_members` (owner/manager/staff), `business_invites`, `business_subscriptions`, `stripe_events`, `categories`, `launch_areas`, `deals`, `appointment_slots`, `follows`, `favorites`, `claims` (vouchers), `redemptions`, `notifications`, `email_outbox`, `push_subscriptions`, `reports`, `audit_log`, `rate_limit_events`. Money is stored as integer cents. Constraints enforce pricing validity, capacity (`claimed_count <= quantity_total`), slot capacity, voucher status/timestamp consistency, one active voucher per customer per deal, one owner per business, and one redemption per voucher.

### Security model

- **Row-level security** is enabled on every table. RLS is the firewall for Supabase's auto-generated REST API: customers can read only their own claims, redemptions, notifications and profile; staff can read their business's data; nobody can write claims, redemptions, deals, subscriptions or businesses through the API. `role` and `share_token` columns aren't client-updatable. `tests/unit/rls.test.ts` verifies this by running queries as the `anon` and `authenticated` roles.
- **Server-side authorization**: all business rules run in server actions and services that check the session, business membership and role, and admin status (re-checked against the DB on every admin action).
- **Vouchers**: QR codes carry a 256-bit random token in a deep link (`/dashboard/redeem?t=…`). Manual codes are 8 characters from a 31-symbol alphabet without look-alikes (0/O, 1/I/L), with a collision check plus a unique index. A scan is never trusted. Both methods resolve through `lookupVoucher` → `confirmRedemption`, which checks business ownership, status, expiry, moderation and off-peak windows on the server.
- **Atomicity**: claims lock the deal (and slot) row inside a transaction. Redemption does `UPDATE … WHERE status = 'active'` plus a unique `redemptions.claim_id`, so concurrent confirmations redeem exactly once (both are covered by tests).
- **Rate limiting** (DB-backed, works across serverless instances): 10 invalid code lookups per staff member per 10 min, sign-in 10 per 15 min per IP+email, sign-up 10/hour/IP, claims 20/hour, reports 5/day, uploads 40/hour.
- Uploads are validated by magic bytes (JPEG/PNG/WebP, max 5 MB). Unsubscribe links are HMAC-signed, require a confirm click, and support RFC 8058 one-click POST. Stripe webhooks are signature-verified and idempotent. Security headers are set in `next.config.ts`.

### Business rules worth knowing

- **Savings** come only from `redemptions`, rows written when a merchant confirms. Claimed vouchers never count. Fixed-price deals: savings = original − discounted, taken from the terms frozen on the voucher at claim time. Percentage / amount-off deals: the merchant enters the bill total and the discounted total at redemption. Confirmed amounts are stored, so later deal edits never change history.
- **Editing**: once a deal has claims, its price, discount type and off-peak schedule are locked, booked slots can't be moved or removed, and quantity can't drop below what's been claimed.
- **Subscriptions**: only `active`/`trialing` can publish or resume. Drafts are always allowed. Already-issued vouchers stay redeemable on their terms if the plan lapses. Deals run at most 60 days.
- **Notifications**: sent once per deal when it actually goes live (on publish, or by the cron sweep for scheduled deals), never for drafts, paused, expired, sold-out or moderated deals. In-app notifications are deduped per user and deal. Emails are capped per user per day (user-set, default 3) and at 2 per business per day. Push is capped at 5/day. Followers can mute a business, and every email has unsubscribe links.
- **Revenue** in analytics is only the sum of amounts confirmed at redemption. Nothing is estimated.

---

## Production setup

Deploy to Vercel (or any Node host). Local demo mode (PGlite) is for development only; production needs Supabase.

### 1. Supabase
1. Create a project. Under **Connect → Transaction pooler**, copy the connection string into `DATABASE_URL`.
2. Apply the migrations: `npx supabase link --project-ref <ref>`, then `npx supabase db push` (or paste the files in `supabase/migrations/` into the SQL editor, in order). This creates the schema, RLS policies and the public `media` storage bucket.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
4. **Auth → URL configuration**: set the Site URL to `NEXT_PUBLIC_APP_URL` and add `<APP_URL>/auth/callback` to the redirect URLs.
5. Optional Google sign-in: enable the Google provider in Supabase, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
6. Optional sample data for staging: `npm run db:seed` (refuses to run in production unless `FC_ALLOW_PROD_SEED=1`).

The server connects with the `postgres` role (table owner, bypasses RLS) and authorizes every request itself. RLS protects the public API that uses the anon key.

### 2. Stripe
1. Create a product "Frugal Center for Business" with a **$29/month recurring price**, and put its id in `STRIPE_PRICE_ID`.
2. Add a webhook endpoint at `<APP_URL>/api/stripe/webhook` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused` and `customer.subscription.resumed`. Copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Enable the **Customer Portal** (Settings → Billing → Customer portal).
4. Set `STRIPE_SECRET_KEY`. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Card details never touch Frugal Center. Subscription status changes only through verified webhooks.

### 3. Resend
Verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.

### 4. Web push (optional)
`npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Users enable push per device in Profile → Notifications. On iOS this requires adding the app to the Home Screen.

### 5. Cron
`vercel.json` schedules `/api/cron/dispatch` every 10 minutes to announce scheduled deals when they start and to prune old rate-limit rows. Set `CRON_SECRET` (Vercel sends it as a bearer token). Note: Vercel Hobby plans only allow daily crons. Use Pro, or call the endpoint from any scheduler. The dashboard and explore pages also run a throttled opportunistic sweep.

### 6. Everything else
`AUTH_SECRET` (32+ chars, required in production), `NEXT_PUBLIC_APP_URL`, and `ADMIN_EMAILS` (comma-separated, promoted to admin on sign-in). See `.env.example` for the full list.

---

## Testing

```bash
npm test
```

20 vitest tests against a real in-memory Postgres (PGlite): discovery and filters, draft visibility, claim issuance, capacity / pause / expiry / own-business rules, **no overselling under concurrent claims**, appointment slots and cancellation releasing capacity, **QR and code resolving to the same voucher**, **concurrent double-redemption (exactly one succeeds)**, invalid / wrong-business / expired / canceled / unauthorized-staff cases, invalid-code rate limiting, merchant-confirmed amounts and off-peak windows, savings counting only redemptions and staying fixed after edits, follower notifications (opt-out, mute, drafts, scheduled, idempotency, email caps), subscription gating, and RLS policies.

```bash
FC_SIGNUP_LIMIT_PER_HOUR=1000 npm run dev
```

```bash
npm run test:e2e
```

Playwright drives the real UI through 16 steps: sign up → choose location (incl. denied geolocation) → discover → follow → merchant publishes → follower notified → claim → voucher with QR + code → invalid code errors → **camera scan** (Chromium's fake camera is fed the voucher's actual QR code) → confirm → reuse blocked → manual code redemption → savings increase → dashboard KPI updates → new business onboarding where publishing is blocked until the plan is active → unauthorized access blocked. Raise the sign-up limit as shown because the script creates new accounts on every run.

Also: `npm run typecheck`, `npm run lint`, `npm run build`.

---

## Known limitations / next steps

- Launch market is Dracut, MA (01826) plus the neighboring ZIPs in Lowell, Tyngsborough, Methuen and Pelham, NH (`launch_areas`). Times use each business's time zone (default `America/New_York`). Business locations use the ZIP centroid plus a draggable map pin rather than a geocoding API.
- Search uses `ILIKE`. Add Postgres full-text search or PostGIS once listings grow.
- No in-app customer–merchant messaging, reviews or ratings (deliberately out of MVP scope, and no ratings are invented).
- The local demo database is single-process. Don't deploy demo mode to serverless hosts.

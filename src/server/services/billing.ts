import type Stripe from "stripe";
import type { Db, Queryable } from "../db/types";
import { env, integrations } from "../env";
import { audit, DomainError } from "./common";

export const PLAN = { name: "Frugal Center for Business", priceCents: 2900, interval: "month" } as const;

export interface Subscription {
  business_id: string;
  provider: "stripe" | "demo";
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
}

export const ACTIVE_STATUSES = ["active", "trialing"];

export async function getSubscription(q: Queryable, businessId: string): Promise<Subscription | null> {
  const [s] = await q.query<Subscription>(`select * from public.business_subscriptions where business_id = $1`, [businessId]);
  return s ?? null;
}

export function isSubscriptionActive(s: Subscription | null) {
  if (!s || !ACTIVE_STATUSES.includes(s.status)) return false;
  // Demo subscriptions only count while Stripe is not configured.
  if (s.provider === "demo" && integrations.stripe) return false;
  return true;
}

export async function assertCanPublish(q: Queryable, businessId: string) {
  const [b] = await q.query(`select suspended_at from public.businesses where id = $1`, [businessId]);
  if (!b) throw new DomainError("not_found", "Business not found.");
  if (b.suspended_at) throw new DomainError("suspended", "This business is suspended. Contact support.");
  if (!isSubscriptionActive(await getSubscription(q, businessId))) {
    throw new DomainError(
      "subscription_inactive",
      "An active $29/month subscription is required to publish deals. You can still save drafts.",
    );
  }
}

let stripeClient: Stripe | null = null;
export async function stripe() {
  if (!integrations.stripe) throw new DomainError("stripe_unconfigured", "Stripe is not configured.");
  if (!stripeClient) {
    const { default: StripeCtor } = await import("stripe");
    stripeClient = new StripeCtor(env.stripeSecretKey!);
  }
  return stripeClient;
}

export async function createCheckoutSession(db: Db, args: { businessId: string; userId: string; email: string }) {
  const s = await stripe();
  const existing = await getSubscription(db, args.businessId);
  if (isSubscriptionActive(existing)) throw new DomainError("already_active", "Your subscription is already active.");
  const [biz] = await db.query(`select name from public.businesses where id = $1`, [args.businessId]);
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env.stripePriceId!, quantity: 1 }],
    customer: existing?.stripe_customer_id ?? undefined,
    customer_email: existing?.stripe_customer_id ? undefined : args.email,
    client_reference_id: args.businessId,
    metadata: { business_id: args.businessId, user_id: args.userId },
    subscription_data: { metadata: { business_id: args.businessId }, description: biz?.name },
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${env.appUrl}/dashboard/billing?checkout=canceled`,
  });
  return session.url!;
}

export async function createPortalSession(db: Db, businessId: string) {
  const s = await stripe();
  const sub = await getSubscription(db, businessId);
  if (!sub?.stripe_customer_id) throw new DomainError("no_customer", "No Stripe billing account yet.");
  const portal = await s.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.appUrl}/dashboard/billing`,
  });
  return portal.url;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Newer API versions moved current_period_end onto subscription items.
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const ts = legacy ?? item?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

export async function upsertFromStripeSubscription(q: Queryable, sub: Stripe.Subscription, businessIdHint?: string | null) {
  const businessId = (sub.metadata?.business_id as string | undefined) ?? businessIdHint;
  if (!businessId) return;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await q.query(
    `insert into public.business_subscriptions
       (business_id, provider, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end, updated_at)
     values ($1, 'stripe', $2, $3, $4::public.subscription_status, $5, $6::timestamptz, $7, now())
     on conflict (business_id) do update set provider = 'stripe', stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id, status = excluded.status, price_id = excluded.price_id,
       current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now()`,
    [
      businessId,
      customerId,
      sub.id,
      sub.status,
      sub.items?.data?.[0]?.price?.id ?? null,
      periodEnd(sub)?.toISOString() ?? null,
      sub.cancel_at_period_end,
    ],
  );
  await audit(q, null, "subscription.synced", "business", businessId, { status: sub.status });
}

/** Called only after the webhook signature has been verified. Idempotent per event id. */
export async function handleStripeEvent(db: Db, event: Stripe.Event) {
  const fresh = await db.query(
    `insert into public.stripe_events (id, type) values ($1, $2) on conflict do nothing returning id`,
    [event.id, event.type],
  );
  if (!fresh.length) return { duplicate: true };
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const s = await stripe();
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await s.subscriptions.retrieve(subId);
          await upsertFromStripeSubscription(db, sub, session.client_reference_id ?? session.metadata?.business_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await upsertFromStripeSubscription(db, event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (err) {
    // Let Stripe retry: forget the event so the retry is processed.
    await db.query(`delete from public.stripe_events where id = $1`, [event.id]);
    throw err;
  }
  return { duplicate: false };
}

/** Local demo only: marks the plan active without any payment. Clearly labelled in the UI. */
export async function activateDemoSubscription(q: Queryable, businessId: string, actorId: string) {
  if (integrations.stripe) throw new DomainError("stripe_configured", "Use Stripe Checkout to subscribe.");
  await q.query(
    `insert into public.business_subscriptions (business_id, provider, status, current_period_end)
     values ($1, 'demo', 'active', now() + interval '30 days')
     on conflict (business_id) do update set provider = 'demo', status = 'active',
       current_period_end = now() + interval '30 days', cancel_at_period_end = false, updated_at = now()`,
    [businessId],
  );
  await audit(q, actorId, "subscription.demo_activated", "business", businessId);
}

export async function cancelDemoSubscription(q: Queryable, businessId: string, actorId: string) {
  await q.query(
    `update public.business_subscriptions set status = 'canceled', updated_at = now()
     where business_id = $1 and provider = 'demo'`,
    [businessId],
  );
  await audit(q, actorId, "subscription.demo_canceled", "business", businessId);
}

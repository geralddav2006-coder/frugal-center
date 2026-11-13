import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { env, integrations } from "@/server/env";
import { handleStripeEvent, stripe } from "@/server/services/billing";

/** Verified Stripe webhook: the only path that activates or changes paid subscriptions. */
export async function POST(req: NextRequest) {
  if (!integrations.stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = (await stripe()).webhooks.constructEvent(raw, signature, env.stripeWebhookSecret!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(await getDb(), event);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("[stripe] webhook failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

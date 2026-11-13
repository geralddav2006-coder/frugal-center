import { Check, CreditCard, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { integrations } from "@/server/env";
import { getSubscription, isSubscriptionActive, PLAN } from "@/server/services/billing";
import { formatDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { FlashToast } from "@/components/welcome-toast";
import { BillingButtons } from "./buttons";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; welcome?: string }> }) {
  const { membership } = await requireBusiness("/dashboard/billing", ["owner"]);
  const { checkout, welcome } = await searchParams;
  const sub = await getSubscription(await getDb(), membership.business_id);
  const active = isSubscriptionActive(sub);
  const statusLabel = sub ? sub.status.replace("_", " ") : "not subscribed";

  return (
    <div className="max-w-3xl">
      <Suspense><FlashToast param="welcome" message="Your business is set up! Activate your plan to start publishing." /></Suspense>
      <h1 className="text-3xl font-extrabold">Billing</h1>
      {welcome ? <p className="mt-2 text-muted">One last step: activate your plan. You can create drafts right away.</p> : null}
      {checkout === "success" ? (
        <p className="mt-4 rounded-xl bg-lime-soft p-3 text-sm font-semibold text-lime-ink">Payment received by Stripe. Your plan activates as soon as Stripe confirms it — usually within a few seconds. Refresh if it still shows inactive.</p>
      ) : checkout === "canceled" ? (
        <p className="mt-4 rounded-xl bg-paper p-3 text-sm font-semibold">Checkout canceled. You haven&apos;t been charged.</p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <p className="font-bold">{PLAN.name}</p>
            <p className="mt-1 flex items-baseline gap-1"><span className="text-4xl font-extrabold">$29</span><span className="text-muted">/month</span></p>
            <p className="text-sm font-semibold text-lime-ink">No commissions, ever.</p>
          </div>
          <div className="text-right">
            <Badge variant={active ? "lime" : sub?.status === "past_due" ? "warning" : "soft"} className="capitalize">{active ? "Active" : statusLabel}</Badge>
            {sub?.provider === "demo" ? <p className="mt-2 text-xs font-semibold text-warning">Demo plan — no payment taken</p> : null}
            {sub?.current_period_end ? (
              <p className="mt-2 text-sm text-muted">{sub.cancel_at_period_end ? "Ends" : "Renews"} {formatDate(sub.current_period_end)}</p>
            ) : null}
          </div>
        </div>
        <ul className="grid gap-2 border-t border-line p-6 text-[15px] sm:grid-cols-2">
          {["Unlimited deal listings", "No sales commissions", "Follower notifications", "QR & code redemption", "Performance analytics", "Staff accounts"].map((b) => (
            <li key={b} className="flex items-center gap-2"><Check className="size-4 text-lime-ink" aria-hidden /> {b}</li>
          ))}
        </ul>
        <div className="border-t border-line bg-paper p-6">
          <BillingButtons active={active} stripe={integrations.stripe} hasCustomer={!!sub?.stripe_customer_id} isDemoPlan={sub?.provider === "demo"} />
          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            {integrations.stripe
              ? "Payments are processed securely by Stripe. Frugal Center never sees or stores your card details."
              : "Stripe isn't configured on this server, so this is a local demo: activating the plan takes no payment. Add Stripe keys to enable real billing."}
          </p>
        </div>
      </section>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted"><CreditCard className="size-4" aria-hidden /> If your plan lapses, you can&apos;t publish new deals, but customers can still redeem vouchers they already claimed.</p>
    </div>
  );
}

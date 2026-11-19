"use client";
import { useTransition } from "react";
import { ExternalLink, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { demoSubscriptionAction, openBillingPortalAction, startCheckoutAction } from "@/app/actions/merchant";

export function BillingButtons({ active, stripe, demo, hasCustomer, isDemoPlan, freeUntil }: { active: boolean; stripe: boolean; demo: boolean; hasCustomer: boolean; isDemoPlan: boolean; freeUntil: string | null }) {
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    start(async () => {
      const res = await fn();
      if (res && !res.ok) toast.error(res.error ?? "Something went wrong");
    });
  if (stripe) {
    return (
      <div className="flex flex-wrap gap-2">
        {!active || freeUntil ? (
          <Button variant={freeUntil ? "outline" : "lime"} size="lg" disabled={pending} onClick={() => go(startCheckoutAction)}>
            {pending ? <Loader2 className="animate-spin" /> : <Zap />} {freeUntil ? `Keep going after ${freeUntil} ($29/month)` : "Subscribe — $29/month"}
          </Button>
        ) : null}
        {hasCustomer ? <Button variant="outline" size="lg" disabled={pending} onClick={() => go(openBillingPortalAction)}><ExternalLink /> Manage billing</Button> : null}
      </div>
    );
  }
  if (freeUntil) return <p className="text-sm font-semibold text-muted">Nothing to pay until {freeUntil}.</p>;
  if (!demo) return <p className="text-sm font-semibold text-muted">Subscriptions aren&apos;t open yet. Email us and we&apos;ll keep you publishing.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {!active ? (
        <Button variant="lime" size="lg" disabled={pending} onClick={() => go(async () => { const r = await demoSubscriptionAction(true); if (r.ok) toast.success("Demo plan activated — no payment taken"); return r; })}>
          <Zap /> Activate demo plan (no charge)
        </Button>
      ) : isDemoPlan ? (
        <Button variant="outline" disabled={pending} onClick={() => go(async () => { const r = await demoSubscriptionAction(false); if (r.ok) toast.success("Demo plan canceled"); return r; })}>
          Cancel demo plan
        </Button>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getSubscription, isSubscriptionActive } from "@/server/services/billing";
import { isDemo } from "@/server/env";
import { scheduleDueDispatch } from "@/server/sweep";
import { Logo, LogoMark } from "@/components/brand";
import { BusinessAvatar } from "@/components/business-avatar";
import { MobileDashboardNav, SidebarNav } from "@/components/merchant/dashboard-nav";
import { BusinessSwitcher } from "@/components/merchant/business-switcher";

export const metadata = { title: { default: "Dashboard", template: "%s · Frugal Center for Business" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { viewer, membership } = await requireBusiness();
  const db = await getDb();
  const sub = await getSubscription(db, membership.business_id);
  const active = isSubscriptionActive(sub);
  scheduleDueDispatch();

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white p-4 lg:flex">
        <div className="px-2">
          <Logo href="/dashboard" />
          <span className="mt-2 ml-[42px] inline-block rounded-full bg-mist px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted uppercase">Business</span>
        </div>
        <div className="mt-6 rounded-2xl bg-paper p-3">
          <div className="flex items-center gap-3">
            <BusinessAvatar name={membership.name} src={membership.logo_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{membership.name}</p>
              <p className="text-xs text-muted capitalize">{membership.role}</p>
            </div>
          </div>
          <BusinessSwitcher current={membership.business_id} options={viewer.memberships.map((m) => ({ id: m.business_id, name: m.name }))} />
        </div>
        <div className="mt-5 flex-1 overflow-y-auto"><SidebarNav role={membership.role} /></div>
        <div className="grid gap-1 border-t border-line pt-3 text-sm">
          <Link href={`/business/${membership.slug}`} className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-muted hover:bg-mist hover:text-ink">
            <ExternalLink className="size-4" aria-hidden /> View public profile
          </Link>
          <Link href="/" className="rounded-lg px-3 py-2 font-semibold text-muted hover:bg-mist hover:text-ink">← Back to Frugal Center</Link>
        </div>
      </aside>

      <div className="min-w-0 pb-28 lg:pb-10">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-lg lg:hidden">
          <Link href="/dashboard" aria-label="Dashboard home"><LogoMark /></Link>
          <p className="min-w-0 truncate font-bold">{membership.name}</p>
          <span className="ml-auto rounded-full bg-mist px-2 py-0.5 text-xs font-semibold capitalize">{membership.role}</span>
        </header>
        {membership.suspended_at ? (
          <div className="flex items-center gap-2 bg-[#fde8e7] px-4 py-3 text-sm font-semibold text-danger sm:px-8">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> This business is suspended by Frugal Center. Your deals are hidden. Contact support.
          </div>
        ) : !active ? (
          <div className="flex flex-wrap items-center gap-2 bg-[#fff4dc] px-4 py-3 text-sm font-semibold text-warning sm:px-8">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {sub?.status === "past_due" ? "Your last payment failed." : sub?.provider === "founding" ? "Your free founding period has ended." : "Your subscription isn't active."} You can save drafts, but publishing is paused.
            {membership.role === "owner" ? <Link href="/dashboard/billing" className="underline">Activate plan</Link> : <span>Ask the owner to activate billing.</span>}
          </div>
        ) : null}
        {isDemo ? <p className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-white/80">Demo mode · sample data · no real payments or emails</p> : null}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <MobileDashboardNav role={membership.role} />
    </div>
  );
}

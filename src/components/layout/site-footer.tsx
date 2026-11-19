import Link from "next/link";
import { Logo } from "@/components/brand";
import { integrations, isDemo } from "@/server/env";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t sm:mt-16 border-line bg-paper pb-28 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">Good deals, close to home. Free for customers. No commissions for businesses — ever.</p>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="font-bold">Customers</p>
          <Link href="/explore" className="text-muted hover:text-ink">Explore deals</Link>
          <Link href="/explore?view=map" className="text-muted hover:text-ink">Map</Link>
          <Link href="/savings" className="text-muted hover:text-ink">Your savings</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="font-bold">Businesses</p>
          <Link href="/for-business" className="text-muted hover:text-ink">List your business</Link>
          <Link href="/for-business#pricing" className="text-muted hover:text-ink">Pricing — 3 months free</Link>
          <Link href="/dashboard" className="text-muted hover:text-ink">Business dashboard</Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} Frugal Center</span>
        <span>
          {isDemo ? "Local demo mode" : "Live"} · Payments {integrations.stripe ? "via Stripe" : "not connected"} · Email{" "}
          {integrations.resend ? "via Resend" : "not connected"}
        </span>
      </div>
    </footer>
  );
}

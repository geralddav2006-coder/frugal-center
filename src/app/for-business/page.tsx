import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3, Bell, CalendarClock, Check, Clock, Infinity as InfinityIcon, MapPin, Package, Percent, QrCode, Smartphone, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = {
  title: "Frugal Center for Business — $29/month, no commissions",
  description: "Fill cancellations, sell surplus inventory and bring customers in during slow hours with exclusive local deals. Flat $29/month. No commissions.",
};

const BENEFITS = [
  { icon: InfinityIcon, title: "Unlimited deal listings", body: "Post as many offers as you like. No per-deal fees." },
  { icon: Percent, title: "No sales commissions", body: "Customers pay you directly. You keep 100% of every sale." },
  { icon: MapPin, title: "Reach nearby customers", body: "Your deals show up for people within minutes of your door." },
  { icon: Bell, title: "Notify your followers", body: "Followers get an alert the moment you publish a new deal." },
  { icon: QrCode, title: "QR and code redemption", body: "Scan with your phone camera or type the code. Secure and instant." },
  { icon: BarChart3, title: "Performance analytics", body: "See claims, redemptions and confirmed revenue for every offer." },
  { icon: Smartphone, title: "No special hardware", body: "Runs in the browser on the phone or tablet you already have." },
];

const FAQ = [
  ["Does Frugal Center take a cut of my sales?", "No. You pay a flat $29/month. Customers pay you directly at your counter or through your existing payment system."],
  ["How do customers redeem?", "They show a QR code or an 8-character code on their phone. Your staff scans it or types it into the Redeem screen, checks the details and confirms."],
  ["Can a voucher be used twice?", "No. Each voucher is verified on our server and can only be redeemed once, by your business."],
  ["What if my plan lapses?", "You can't publish new deals, but customers who already claimed vouchers can still redeem them on their original terms."],
  ["Can my staff redeem without seeing billing?", "Yes. Invite staff with a Staff role — they can redeem vouchers but can't edit deals or billing."],
];

export default async function ForBusinessPage() {
  const viewer = await getViewer();
  const isMember = !!viewer?.memberships.length;
  const startHref = viewer ? (isMember ? "/dashboard" : "/for-business/start") : "/signup?next=/for-business/start";
  const ctaLabel = isMember ? "Go to dashboard" : "Start Listing Deals";

  return (
    <div className="bg-white pb-24 sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo suffix="for Business" />
          <nav className="ml-auto flex items-center gap-1">
            <Link href="#pricing" className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-mist sm:block">Pricing</Link>
            {viewer ? null : <Link href="/login?next=/dashboard" className="rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap hover:bg-mist">Sign in</Link>}
            <Button asChild size="sm" className="hidden sm:inline-flex"><Link href={startHref}>{ctaLabel}</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pt-8 pb-10 text-center sm:px-6 sm:pt-16 sm:pb-16 sm:text-left lg:grid-cols-[1.15fr_1fr] lg:px-8">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-extrabold">
              <Sparkles className="size-3.5" aria-hidden /> $29/month · zero commissions
            </p>
            <h1 className="mx-auto mt-4 max-w-[17ch] text-[31px] leading-[1.06] font-extrabold tracking-[-0.02em] min-[400px]:text-[34px] sm:mx-0 sm:mt-5 sm:max-w-none sm:text-6xl sm:leading-[1.02]">
              Turn empty time slots and unsold inventory into <span className="text-lime-ink">revenue.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-[34ch] text-[16px] leading-relaxed text-muted sm:mx-0 sm:mt-5 sm:max-w-xl sm:text-lg">
              Fill cancellations, sell surplus inventory, and bring customers through your door with exclusive local deals.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Button asChild variant="lime" size="lg" className="w-full sm:w-auto"><Link href={startHref}>{ctaLabel}</Link></Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto"><Link href="#how-it-works">See How It Works</Link></Button>
            </div>
            <p className="mt-4 text-sm text-muted">Cancel anytime. Customers always claim for free.</p>
          </div>

          {/* Product preview built from real UI pieces (illustrative content) */}
          <div className="relative mx-auto w-full max-w-[300px] sm:max-w-sm" aria-hidden>
            <div className="absolute -inset-8 -z-10 rounded-[48px] bg-[radial-gradient(circle_at_70%_30%,#e0fdeb,transparent_60%)]" />
            <div className="rounded-[32px] border-[8px] border-ink bg-white p-3.5 text-left shadow-[var(--shadow-lift)] sm:rounded-[36px] sm:border-[10px] sm:p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted"><span>Redeem</span><span>Main Street Bakery</span></div>
              <div className="mt-3 rounded-2xl bg-ink p-4 text-white sm:p-5">
                <p className="text-xs text-white/60">Voucher verified</p>
                <p className="mt-1 text-lg font-extrabold">Surprise Pastry Box</p>
                <p className="text-sm text-white/70">$9 instead of $20 · 55% OFF</p>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-lime px-3 py-2.5 text-sm font-extrabold text-ink"><Check className="size-4" /> Redemption Successful</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["Claims", "41"], ["Redeemed", "33"], ["Followers", "212"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-paper p-2.5">
                    <p className="text-lg font-extrabold">{v}</p>
                    <p className="text-[11px] text-muted">{k}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-muted">Illustrative example</p>
            </div>
          </div>
        </div>
      </section>

      {/* Price strip */}
      <section className="border-y border-line bg-paper" aria-label="At a glance">
        <ul className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-line px-2 py-5 text-center sm:px-6 lg:px-8">
          {[["$29", "per month"], ["0%", "commission"], ["2 min", "to post a deal"]].map(([v, k]) => (
            <li key={k} className="px-2">
              <p className="font-display text-xl font-extrabold sm:text-3xl">{v}</p>
              <p className="text-[12px] font-semibold text-muted sm:text-sm">{k}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h2 className="text-center text-[26px] font-extrabold sm:text-left sm:text-4xl">How it works</h2>
          <ol className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
            {[
              ["Post a deal in under two minutes", "Pick a deal type, set your price and availability, preview it, and publish."],
              ["Neighbors claim it for free", "Nearby customers and your followers get notified and claim a voucher on their phone."],
              ["Scan, confirm, done", "When they arrive, scan the QR code or enter their code. They pay you directly."],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-4 rounded-[var(--radius-card)] bg-paper p-4 sm:block sm:p-6">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-lime">{i + 1}</span>
                <div>
                  <h3 className="text-[17px] leading-snug font-extrabold sm:mt-4 sm:text-lg">{t}</h3>
                  <p className="mt-1 text-[15px] text-muted">{b}</p>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-12 text-center text-xl font-extrabold sm:text-left">Three ways to fill the gaps</h3>
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
            {[
              { icon: Package, t: "Surplus inventory", b: "Bakery leftovers, extra flowers, overstock retail. Set a quantity and a pickup window." },
              { icon: CalendarClock, t: "Canceled appointments", b: "Nail, hair, massage and training slots. List the exact open times and capacity." },
              { icon: Clock, t: "Slow business hours", b: "Afternoon lulls and off-peak periods. Choose days, hours and a discount." },
            ].map(({ icon: Icon, t, b }) => (
              <div key={t} className="w-[78%] shrink-0 snap-center rounded-[var(--radius-card)] border border-line bg-white p-5 sm:w-auto sm:p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-lime-soft"><Icon className="size-5 text-lime-ink" aria-hidden /></span>
                <h4 className="mt-3 font-extrabold">{t}</h4>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-10 lg:px-8">
          <div className="text-center lg:text-left">
            <h2 className="text-[28px] font-extrabold sm:text-4xl">One simple price.</h2>
            <p className="mx-auto mt-3 max-w-md text-[16px] text-white/70 sm:text-lg lg:mx-0">
              Fill one canceled appointment or sell one box of leftovers a week and Frugal Center has paid for itself.
            </p>
          </div>
          <div className="rounded-[26px] bg-white p-6 text-ink sm:rounded-[28px] sm:p-8">
            <div className="text-center sm:text-left">
              <p className="font-bold">Frugal Center for Business</p>
              <p className="mt-2 flex items-baseline justify-center gap-1 sm:justify-start">
                <span className="font-display text-6xl font-extrabold tracking-tight">$29</span><span className="text-muted">/month</span>
              </p>
              <p className="mt-1 inline-block rounded-full bg-lime-soft px-3 py-1 text-sm font-bold text-lime-ink">0% commission on every sale</p>
            </div>
            <ul className="mt-6 grid gap-2.5 border-t border-line pt-5">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-center gap-2.5 text-[15px]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime"><Check className="size-3.5" aria-hidden /></span>
                  {b.title}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-7 w-full"><Link href={startHref}>{ctaLabel}</Link></Button>
            <p className="mt-3 text-center text-xs text-muted">Billed monthly through Stripe. Cancel anytime from your dashboard.</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h2 className="mx-auto max-w-[16ch] text-center text-[26px] font-extrabold sm:mx-0 sm:max-w-2xl sm:text-left sm:text-4xl">Everything you need. Nothing you don&apos;t.</h2>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-8 sm:gap-y-8 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="grid size-10 place-items-center rounded-xl bg-mist sm:size-11"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-3 text-[15px] leading-snug font-extrabold sm:text-base">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted sm:text-sm">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-paper">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <h2 className="text-center text-[26px] font-extrabold sm:text-left sm:text-3xl">Questions</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4 sm:py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold sm:text-lg">
                  {q}<span className="text-2xl text-muted transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-[15px] text-muted">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="lime" size="lg" className="w-full sm:w-auto"><Link href={startHref}>{ctaLabel}</Link></Button>
          </div>
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <Link href="/" className="font-semibold hover:text-ink">Browse deals as a customer →</Link>
      </footer>

      {/* Mobile sticky call to action */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-lg sm:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 leading-tight">
            <p className="font-display text-lg font-extrabold">$29<span className="font-sans text-sm font-semibold text-muted">/mo</span></p>
            <p className="text-xs font-semibold text-lime-ink">0% commission</p>
          </div>
          <Button asChild variant="lime" className="ml-auto h-12 flex-1"><Link href={startHref}>{ctaLabel}</Link></Button>
        </div>
      </div>
    </div>
  );
}

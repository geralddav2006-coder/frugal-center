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
  const startHref = viewer ? (viewer.memberships.length ? "/dashboard" : "/for-business/start") : "/signup?next=/for-business/start";
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo suffix="for Business" />
          <nav className="ml-auto flex items-center gap-1">
            <Link href="#pricing" className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-mist sm:block">Pricing</Link>
            {viewer ? null : <Link href="/login?next=/dashboard" className="rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap hover:bg-mist">Sign in</Link>}
            <Button asChild size="sm">
              <Link href={startHref}>
                {viewer?.memberships.length ? "Dashboard" : (<><span className="sm:hidden">Get started</span><span className="hidden sm:inline">Start Listing Deals</span></>)}
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:px-8">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-extrabold">
              <Sparkles className="size-3.5" aria-hidden /> $29/month · zero commissions
            </p>
            <h1 className="mt-5 text-[42px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-6xl">
              Turn empty time slots and unsold inventory into <span className="marker">revenue.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Fill cancellations, sell surplus inventory, and bring customers through your door with exclusive local deals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="lime" size="lg"><Link href={startHref}>Start Listing Deals</Link></Button>
              <Button asChild variant="outline" size="lg"><Link href="#how-it-works">See How It Works</Link></Button>
            </div>
            <p className="mt-4 text-sm text-muted">Cancel anytime. Customers always claim for free.</p>
          </div>

          {/* Product preview built from real UI pieces (illustrative content) */}
          <div className="relative mx-auto w-full max-w-sm" aria-hidden>
            <div className="absolute -inset-8 -z-10 rounded-[48px] bg-[radial-gradient(circle_at_70%_30%,#f1ffcc,transparent_60%)]" />
            <div className="rounded-[36px] border-[10px] border-ink bg-white p-4 shadow-[var(--shadow-lift)]">
              <div className="flex items-center justify-between text-xs font-semibold text-muted"><span>Redeem</span><span>Main Street Bakery</span></div>
              <div className="mt-3 rounded-2xl bg-ink p-5 text-white">
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

      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold sm:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Post a deal in under two minutes", "Pick a deal type, set your price and availability, preview it, and publish."],
              ["Neighbors claim it for free", "Nearby customers and your followers get notified and claim a voucher on their phone."],
              ["Scan, confirm, done", "When they arrive, scan the QR code or enter their code. They pay you directly."],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-[var(--radius-card)] bg-white p-6">
                <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-extrabold text-lime">{i + 1}</span>
                <h3 className="mt-4 text-lg font-extrabold">{t}</h3>
                <p className="mt-1 text-muted">{b}</p>
              </li>
            ))}
          </ol>

          <h3 className="mt-14 text-xl font-extrabold">Three ways to fill the gaps</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { icon: Package, t: "Surplus inventory", b: "Bakery leftovers, extra flowers, overstock retail. Set a quantity and a pickup window." },
              { icon: CalendarClock, t: "Canceled appointments", b: "Nail, hair, massage and training slots. List the exact open times and capacity." },
              { icon: Clock, t: "Slow business hours", b: "Afternoon lulls and off-peak periods. Choose days, hours and a discount." },
            ].map(({ icon: Icon, t, b }) => (
              <div key={t} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <Icon className="size-6" aria-hidden />
                <h4 className="mt-3 font-extrabold">{t}</h4>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="max-w-2xl text-3xl font-extrabold sm:text-4xl">Everything you need. Nothing you don&apos;t.</h2>
        <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="grid size-11 place-items-center rounded-xl bg-mist"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-3 font-extrabold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">One simple price.</h2>
            <p className="mt-3 max-w-md text-lg text-white/70">
              Fill one canceled appointment or sell one box of leftovers a week and Frugal Center has paid for itself.
            </p>
          </div>
          <div className="rounded-[28px] bg-white p-8 text-ink">
            <p className="font-bold">Frugal Center for Business</p>
            <p className="mt-2 flex items-baseline gap-1"><span className="text-6xl font-extrabold tracking-tight">$29</span><span className="text-muted">/month</span></p>
            <p className="mt-1 text-sm font-semibold text-lime-ink">0% commission on every sale</p>
            <ul className="mt-6 grid gap-2.5">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-center gap-2.5 text-[15px]"><span className="grid size-5 place-items-center rounded-full bg-lime"><Check className="size-3.5" aria-hidden /></span>{b.title}</li>
              ))}
            </ul>
            <Button asChild variant="default" size="lg" className="mt-7 w-full"><Link href={startHref}>Start Listing Deals</Link></Button>
            <p className="mt-3 text-center text-xs text-muted">Billed monthly through Stripe. Cancel anytime from your dashboard.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-extrabold">Questions</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                {q}<span className="text-2xl text-muted transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button asChild variant="lime" size="lg"><Link href={startHref}>Start Listing Deals</Link></Button>
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <Link href="/" className="font-semibold hover:text-ink">Browse deals as a customer →</Link>
      </footer>
    </div>
  );
}

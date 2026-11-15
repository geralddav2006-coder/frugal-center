import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { getSharedSavings } from "@/server/services/savings";
import { formatMoney } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getSharedSavings(await getDb(), (await params).token);
  if (!s) return { title: "Frugal Center", robots: { index: false } };
  const title = `${s.firstName} has saved ${formatMoney(s.totalCents)} with Frugal Center`;
  return { title, description: "Deals from local businesses — free for everyone.", robots: { index: false }, openGraph: { title } };
}

export default async function SharedSavingsPage({ params }: Props) {
  const s = await getSharedSavings(await getDb(), (await params).token);
  if (!s) notFound();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-10">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-ink p-9 text-white shadow-[var(--shadow-lift)]">
        <Logo className="[&_span]:text-white" />
        <p className="mt-10 text-lg text-white/70">{s.firstName} has saved</p>
        <p className="text-[72px] leading-none font-display font-extrabold tracking-[-0.02em] text-lime tabular">{formatMoney(s.totalCents)}</p>
        <p className="mt-4 text-lg">
          on {s.count} local {s.count === 1 ? "deal" : "deals"} at {s.businesses} neighborhood {s.businesses === 1 ? "business" : "businesses"}.
        </p>
        <div aria-hidden className="absolute -right-16 -bottom-16 size-56 rounded-full bg-lime/20 blur-3xl" />
      </div>
      <p className="mt-8 max-w-sm text-center text-muted">Frugal Center finds discounts from local businesses near you. Always free.</p>
      <Button asChild variant="lime" size="lg" className="mt-5"><Link href="/signup">Start saving</Link></Button>
    </div>
  );
}

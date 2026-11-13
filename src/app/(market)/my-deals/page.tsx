import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronRight, Heart, History, Ticket } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { listVouchers, type VoucherRow } from "@/server/services/claims";
import { listLiveDeals } from "@/server/services/discovery";
import { listSavedDealIds } from "@/server/services/engagement";
import { priceDisplay } from "@/lib/deals";
import { formatDateTime, formatDayTime, timeLeft } from "@/lib/time";
import { cn, formatMoney } from "@/lib/utils";
import { SmartImage } from "@/components/smart-image";
import { DealCard } from "@/components/deals/deal-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Deals" };

const TABS = [
  { key: "active", label: "Vouchers", icon: Ticket },
  { key: "saved", label: "Saved", icon: Heart },
  { key: "history", label: "History", icon: History },
] as const;

export default async function MyDealsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireViewer("/my-deals");
  const { tab: raw } = await searchParams;
  const tab = TABS.some((t) => t.key === raw) ? raw! : "active";
  const db = await getDb();
  const vouchers = await listVouchers(db, viewer.id);
  const active = vouchers.filter((v) => v.state === "active");
  const history = vouchers.filter((v) => v.state !== "active");

  let saved: Awaited<ReturnType<typeof listLiveDeals>> = [];
  let savedEnded = 0;
  if (tab === "saved") {
    const ids = await listSavedDealIds(db, viewer.id);
    if (ids.length) {
      saved = await listLiveDeals(db, await getViewerLocation(viewer), { dealIds: ids, limit: 200, sort: "ending" }, viewer.id);
      savedEnded = ids.length - saved.length;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="text-3xl font-extrabold">My Deals</h1>
      <nav className="mt-5 inline-flex rounded-full bg-mist p-1" aria-label="My deals sections">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link key={key} href={`/my-deals?tab=${key}`} aria-current={tab === key ? "page" : undefined}
            className={cn("flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition", tab === key ? "bg-white shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink")}>
            <Icon className="size-4" aria-hidden /> {label}
            {key === "active" && active.length ? <span className="rounded-full bg-lime px-1.5 text-xs font-extrabold text-ink">{active.length}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "active" ? (
          active.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">{active.map((v) => <VoucherRowItem key={v.id} v={v} />)}</ul>
          ) : (
            <EmptyState icon={<Ticket />} title="No active vouchers" action={<Button asChild><Link href="/">Explore deals</Link></Button>}>
              When you claim a deal, your voucher with its QR code and redemption code will be here.
            </EmptyState>
          )
        ) : tab === "saved" ? (
          saved.length ? (
            <>
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{saved.map((d) => <DealCard key={d.id} deal={d} signedIn />)}</div>
              {savedEnded ? <p className="mt-6 text-sm text-muted">{savedEnded} saved {savedEnded === 1 ? "deal has" : "deals have"} ended and {savedEnded === 1 ? "is" : "are"} hidden.</p> : null}
            </>
          ) : (
            <EmptyState icon={<Heart />} title="No saved deals" action={<Button asChild><Link href="/">Explore deals</Link></Button>}>
              Tap the heart on any deal to save it for later.
            </EmptyState>
          )
        ) : history.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">{history.map((v) => <VoucherRowItem key={v.id} v={v} />)}</ul>
        ) : (
          <EmptyState icon={<History />} title="No history yet">Redeemed, canceled and expired vouchers will show up here.</EmptyState>
        )}
      </div>
    </div>
  );
}

function VoucherRowItem({ v }: { v: VoucherRow }) {
  const p = priceDisplay(v.terms);
  const badge = {
    active: <Badge variant="lime" size="sm">Ready</Badge>,
    redeemed: <Badge variant="success" size="sm">Redeemed</Badge>,
    canceled: <Badge variant="soft" size="sm">Canceled</Badge>,
    expired: <Badge variant="danger" size="sm">Expired</Badge>,
  }[v.state];
  return (
    <li>
      <Link href={`/vouchers/${v.id}`} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line p-3 transition hover:border-ink hover:shadow-[var(--shadow-soft)]">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-mist">
          <SmartImage src={v.image} alt="" sizes="80px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">{badge}<span className="truncate text-xs font-semibold text-muted">{v.business_name}</span></div>
          <p className="mt-1 truncate font-bold">{v.terms.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
            {v.state === "active" ? (
              v.terms.slot_starts_at ? (<><CalendarClock className="size-3.5" aria-hidden /> {formatDayTime(v.terms.slot_starts_at, v.terms.timezone)}</>) : `Expires in ${timeLeft(v.expires_at)}`
            ) : v.state === "redeemed" ? (
              <span className="font-semibold text-lime-ink">+{formatMoney(v.savings_cents ?? 0, { exact: (v.savings_cents ?? 0) % 100 !== 0 })} saved · {formatDateTime(v.redeemed_at!)}</span>
            ) : (
              <>{p.headline} · {formatDateTime(v.state === "canceled" ? v.canceled_at! : v.expires_at)}</>
            )}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

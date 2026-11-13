import Link from "next/link";
import { ChevronRight, PlusCircle, Tags } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { listMerchantDeals, type MerchantDeal } from "@/server/services/merchant";
import { DEAL_TYPE_META, priceDisplay, type DealType } from "@/lib/deals";
import { formatDateTime, timeLeft } from "@/lib/time";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/smart-image";
import { DealStateBadge } from "@/components/merchant/deal-state-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My Deals" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
  { key: "paused", label: "Paused" },
  { key: "past", label: "Past" },
];

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { membership } = await requireBusiness();
  const { f = "all" } = await searchParams;
  const all = await listMerchantDeals(await getDb(), membership.business_id);
  const deals = all.filter((d) =>
    f === "all" ? true : f === "past" ? ["ended", "sold_out", "removed"].includes(d.state) : d.state === f,
  );
  const canCreate = membership.role !== "staff";
  const live = all.filter((d) => d.state === "live");
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">My Deals</h1>
        {canCreate ? <Button asChild variant="lime"><Link href="/dashboard/deals/new"><PlusCircle /> Create Deal</Link></Button> : null}
      </div>
      <LiveNowPanel deals={live} timezone={membership.timezone} canCreate={canCreate} />

      <nav className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4" aria-label="Filter deals">
        {FILTERS.map((x) => {
          const n = x.key === "all" ? all.length : x.key === "past" ? all.filter((d) => ["ended", "sold_out", "removed"].includes(d.state)).length : all.filter((d) => d.state === x.key).length;
          return (
            <Link key={x.key} href={`/dashboard/deals?f=${x.key}`} aria-current={f === x.key ? "page" : undefined}
              className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold", f === x.key ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
              {x.key === "live" && n > 0 ? <RedPulse /> : null}
              {x.label} <span className={f === x.key ? "text-white/60" : "text-muted"}>{n}</span>
            </Link>
          );
        })}
      </nav>
      {deals.length ? (
        <ul className="mt-5 grid gap-3">
          {deals.map((d) => {
            const p = priceDisplay(d as never);
            return (
              <li key={d.id}>
                <Link href={`/dashboard/deals/${d.id}`} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-3 transition hover:border-ink">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-mist sm:size-20"><SmartImage src={d.images[0]} alt="" sizes="80px" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><DealStateBadge state={d.state} /><span className="text-xs font-semibold text-muted">{DEAL_TYPE_META[d.type as DealType].short}</span></div>
                    <p className="mt-1 truncate font-bold">{d.title}</p>
                    <p className="truncate text-sm text-muted">{p.headline}{p.original ? ` (reg. ${p.original})` : ""} · ends {formatDateTime(d.ends_at, membership.timezone)}</p>
                  </div>
                  <div className="hidden shrink-0 gap-6 text-center sm:flex">
                    <div><p className="text-lg font-extrabold tabular">{d.claims_total}</p><p className="text-xs text-muted">Claims</p></div>
                    <div><p className="text-lg font-extrabold tabular">{d.redemptions_total}</p><p className="text-xs text-muted">Redeemed</p></div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon={<Tags />} title={f === "all" ? "No deals yet" : "Nothing here"} action={canCreate ? <Button asChild><Link href="/dashboard/deals/new">Create your first deal</Link></Button> : null}>
          {f === "all" ? "Turn surplus stock, open appointments or quiet hours into customers." : "No deals match this filter."}
        </EmptyState>
      )}
    </div>
  );
}

function RedPulse() {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
      <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
    </span>
  );
}

function LiveNowPanel({ deals, timezone, canCreate }: { deals: MerchantDeal[]; timezone: string; canCreate: boolean }) {
  if (!deals.length) {
    return (
      <section className="mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4" aria-label="Live now">
        <span className="size-2.5 shrink-0 rounded-full bg-line" aria-hidden />
        <p className="flex-1 text-[15px] font-semibold">Nothing is live right now</p>
        {canCreate ? <Button asChild size="sm" variant="lime"><Link href="/dashboard/deals/new">Create a deal</Link></Button> : null}
      </section>
    );
  }
  return (
    <section className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white" aria-label="Live now">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <RedPulse />
        <p className="font-bold">{deals.length} {deals.length === 1 ? "deal is" : "deals are"} live now</p>
        <p className="hidden text-sm text-muted sm:block">· customers can see and claim {deals.length === 1 ? "it" : "them"}</p>
        <Link href="/dashboard/deals?f=live" className="ml-auto text-sm font-bold text-lime-ink hover:underline">View all</Link>
      </div>
      <ul className="divide-y divide-line">
        {deals.slice(0, 5).map((d) => {
          const left = d.quantity_total != null ? Math.max(0, d.quantity_total - d.claimed_count) : null;
          return (
            <li key={d.id}>
              <Link href={`/dashboard/deals/${d.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-paper">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-mist"><SmartImage src={d.images[0]} alt="" sizes="48px" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{d.title}</p>
                  <p className="truncate text-[13px] text-muted">
                    {left != null ? `${left} left · ` : ""}ends in {timeLeft(d.ends_at)} · {formatDateTime(d.ends_at, timezone)}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[13px] leading-tight">
                  <p><span className="font-extrabold tabular">{d.claims_total}</span> <span className="text-muted">claimed</span></p>
                  <p><span className="font-extrabold tabular">{d.redemptions_total}</span> <span className="text-muted">redeemed</span></p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

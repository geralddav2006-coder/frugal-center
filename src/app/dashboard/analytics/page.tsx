import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getAnalytics, type Range } from "@/server/services/merchant";
import { DEAL_TYPE_META, type DealType } from "@/lib/deals";
import { cn, formatMoney } from "@/lib/utils";
import { LineChart } from "@/components/charts/line-chart";
import { DealStateBadge } from "@/components/merchant/deal-state-badge";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Analytics" };

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { membership } = await requireBusiness("/dashboard/analytics", ["owner", "manager"]);
  const { range: raw } = await searchParams;
  const range = (RANGES.some((r) => r.key === raw) ? raw : "30d") as Range;
  const { totals, daily, byOffer } = await getAnalytics(await getDb(), membership.business_id, range);
  const conversion = totals.claims ? Math.round((totals.redemptions / totals.claims) * 100) : null;
  const kpis = [
    { label: "Active offers", value: totals.active_offers, note: "right now" },
    { label: "Offers claimed", value: totals.claims },
    { label: "Offers redeemed", value: totals.redemptions },
    { label: "Redemption rate", value: conversion == null ? "—" : `${conversion}%`, note: "redeemed ÷ claimed" },
    { label: "Confirmed revenue", value: formatMoney(totals.revenue_cents), note: "paid on redeemed deals" },
    { label: "New followers", value: totals.new_followers },
  ];
  const hasData = daily.some((d) => d.claims || d.redemptions);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Analytics</h1>
        <nav className="inline-flex rounded-full bg-mist p-1" aria-label="Date range">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/dashboard/analytics?range=${r.key}`} aria-current={range === r.key ? "page" : undefined}
              className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", range === r.key ? "bg-white shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink")}>
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Metrics">
        {kpis.map((k) => {
          const hero = k.label === "Confirmed revenue";
          return (
            <div key={k.label} className={hero ? "rounded-[var(--radius-card)] bg-ink p-4 text-white" : "rounded-[var(--radius-card)] border border-line bg-white p-4"}>
              <p className={hero ? "text-[13px] font-semibold text-white/70" : "text-[13px] font-semibold text-muted"}>{k.label}</p>
              <p className={hero ? "mt-1 font-display text-2xl font-extrabold text-lime tabular" : "mt-1 text-2xl font-extrabold tabular"}>{k.value}</p>
              {k.note ? <p className={hero ? "text-xs text-white/60" : "text-xs text-muted"}>{k.note}</p> : null}
            </div>
          );
        })}
      </section>
      <p className="mt-3 text-xs text-muted">
        Revenue counts only amounts confirmed at redemption — what customers paid for redeemed deals. Frugal Center doesn&apos;t estimate sales it can&apos;t verify.
      </p>

      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
        <h2 className="font-extrabold">Claims and redemptions per day</h2>
        <p className="mb-4 text-sm text-muted">{range === "all" ? "Last 90 days" : RANGES.find((r) => r.key === range)!.label}</p>
        {hasData ? (
          <LineChart
            title="Claims and redemptions per day"
            labels={daily.map((d) => DAY.format(new Date(`${d.day}T00:00:00Z`)))}
            series={[
              // Brand palette: redemptions in dark brand green with an electric-green area,
              // claims as a dashed charcoal reference line (CVD-safe pair, see dataviz check).
              { name: "Redemptions", color: "#0b7a3b", fill: "#2ef27a", values: daily.map((d) => d.redemptions) },
              { name: "Claims", color: "#191919", dashed: true, values: daily.map((d) => d.claims) },
            ]}
          />
        ) : (
          <EmptyState icon={<BarChart3 />} title="No activity in this period">Publish a deal and claims will start showing up here.</EmptyState>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
        <h2 className="p-5 pb-3 font-extrabold sm:px-6">Performance by offer</h2>
        {byOffer.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-y border-line bg-paper text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-semibold sm:px-6">Offer</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Claims</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Redeemed</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Rate</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byOffer.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 sm:px-6">
                      <Link href={`/dashboard/deals/${o.id}`} className="font-semibold hover:underline">{o.title}</Link>
                      <div className="mt-0.5 flex items-center gap-2"><DealStateBadge state={o.state} /><span className="text-xs text-muted">{DEAL_TYPE_META[o.type as DealType].short}</span></div>
                    </td>
                    <td className="px-3 py-3 text-right tabular">{o.claims}</td>
                    <td className="px-3 py-3 text-right tabular">{o.redemptions}</td>
                    <td className="px-3 py-3 text-right tabular">{o.claims ? `${Math.round((o.redemptions / o.claims) * 100)}%` : "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular sm:px-6">{formatMoney(o.revenue_cents, { exact: o.revenue_cents % 100 !== 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 pb-6 text-sm text-muted">No published offers yet.</p>
        )}
      </section>
    </div>
  );
}

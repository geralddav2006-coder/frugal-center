import Link from "next/link";
import { ArrowRight, CheckCircle2, Heart, PlusCircle, ScanLine, Tags, Ticket, Users, Wallet } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getOverview } from "@/server/services/merchant";
import { relativeAgo } from "@/lib/time";
import { formatMoney, privateName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { viewer, membership } = await requireBusiness();
  const { denied } = await searchParams;
  const { stats, activity } = await getOverview(await getDb(), membership.business_id);
  const canCreate = membership.role !== "staff";
  const first = viewer.fullName?.split(" ")[0];

  const kpis = [
    { label: "Active Deals", value: stats.active_deals, icon: Tags },
    { label: "Total Claims", value: stats.total_claims, icon: Ticket },
    { label: "Completed Redemptions", value: stats.redemptions, icon: CheckCircle2 },
    { label: "Followers", value: stats.followers, icon: Users },
    { label: "Revenue from redeemed offers", value: formatMoney(stats.revenue_cents ?? 0), icon: Wallet, hint: "Sum of confirmed amounts customers paid on redemption" },
  ];

  return (
    <div>
      {denied ? <p className="mb-4 rounded-xl bg-[#fff4dc] p-3 text-sm font-semibold text-warning">Your role doesn&apos;t have access to that page.</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{first ? `Hi ${first} 👋` : "Welcome back"}</p>
          <h1 className="text-3xl font-extrabold">{membership.name}</h1>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/redeem"><ScanLine /> Redeem a voucher</Link></Button>
      </div>

      {canCreate ? (
        <Link href="/dashboard/deals/new" className="group mt-6 flex items-center gap-5 rounded-[24px] bg-lime p-6 transition hover:shadow-[var(--shadow-lift)] sm:p-7">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-lime"><PlusCircle className="size-7" aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold">Create Deal</p>
            <p className="text-[15px] text-ink/75">Surplus stock, an open appointment, or a slow afternoon? Post it in under two minutes.</p>
          </div>
          <ArrowRight className="ml-auto hidden size-6 shrink-0 transition group-hover:translate-x-1 sm:block" aria-hidden />
        </Link>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Key metrics">
        {kpis.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-[var(--radius-card)] border border-line bg-white p-4 last:col-span-2 lg:last:col-span-1" title={hint}>
            <Icon className="size-5 text-muted" aria-hidden />
            <p className="mt-3 text-2xl font-extrabold tabular">{value}</p>
            <p className="text-[13px] font-semibold text-muted">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Recent activity</h2>
          {membership.role !== "staff" ? <Link href="/dashboard/analytics" className="text-sm font-semibold underline-offset-4 hover:underline">Analytics</Link> : null}
        </div>
        {activity.length ? (
          <ul className="mt-3 divide-y divide-line">
            {activity.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${a.kind === "redemption" ? "bg-lime" : "bg-mist"}`}>
                  {a.kind === "redemption" ? <CheckCircle2 className="size-4" aria-hidden /> : a.kind === "claim" ? <Ticket className="size-4" aria-hidden /> : <Heart className="size-4" aria-hidden />}
                </span>
                <p className="min-w-0 flex-1 text-[15px]">
                  <strong>{privateName(a.who)}</strong>{" "}
                  {a.kind === "redemption" ? <>redeemed <strong>{a.title}</strong>{a.amount != null ? ` · paid ${formatMoney(a.amount, { exact: true })}` : ""}</>
                    : a.kind === "claim" ? <>claimed <strong>{a.title}</strong></> : "started following you"}
                </p>
                <span className="shrink-0 text-xs text-muted">{relativeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-4" icon={<Ticket />} title="No activity yet">Claims, redemptions and new followers will appear here.</EmptyState>
        )}
      </section>
    </div>
  );
}

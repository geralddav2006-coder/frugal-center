import type { Metadata } from "next";
import Link from "next/link";
import { PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { getSavingsSummary } from "@/server/services/savings";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatMoney } from "@/lib/utils";
import { BarChart } from "@/components/charts/bar-chart";
import { ShareSavings } from "@/components/share-savings";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Your savings" };

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export default async function SavingsPage() {
  const viewer = await requireViewer("/savings");
  const db = await getDb();
  const s = await getSavingsSummary(db, viewer.id);
  const [{ share_token }] = (await db.query(`select share_token from public.profiles where id = $1`, [viewer.id])) as { share_token: string | null }[];
  const total = formatMoney(s.totalCents, { exact: s.totalCents % 100 !== 0 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] bg-ink p-7 text-white sm:p-10">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/70"><PiggyBank className="size-4" aria-hidden /> Your Total Savings</p>
        <p className="mt-2 text-[56px] leading-none font-extrabold tracking-[-0.04em] text-lime tabular sm:text-[88px]">{total}</p>
        <p className="mt-2 text-lg font-semibold">saved</p>
        <p className="mt-4 max-w-md text-sm text-white/60">
          Counted only when a business confirms your redemption — claimed-but-unused deals never count.
        </p>
        <div className="mt-6">
          <ShareSavings initialUrl={share_token ? `${env.appUrl}/s/${share_token}` : null} totalLabel={total} count={s.count} />
        </div>
        <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-lime/10 blur-3xl" />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Savings statistics">
        {[
          { label: "Total savings", value: total },
          { label: "This month", value: formatMoney(s.monthCents) },
          { label: "Deals redeemed", value: String(s.count) },
          { label: "Avg. per redemption", value: formatMoney(s.avgCents) },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-card)] border border-line p-5">
            <p className="text-sm font-semibold text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular">{k.value}</p>
          </div>
        ))}
      </section>

      {s.count === 0 ? (
        <EmptyState className="mt-8" icon={<Receipt />} title="No savings yet" action={<Button asChild><Link href="/">Find a deal</Link></Button>}>
          Claim a deal and redeem it at the business — your savings will show up here as soon as they confirm.
        </EmptyState>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <section className="rounded-[var(--radius-card)] border border-line p-6">
            <h2 className="flex items-center gap-2 font-extrabold"><TrendingUp className="size-5" aria-hidden /> Savings history</h2>
            <p className="mb-6 text-sm text-muted">Last 6 months · since {formatDate(s.firstRedemptionAt!)}</p>
            <BarChart
              title="Savings per month"
              data={s.monthly.map((m, i) => ({
                key: m.month,
                label: MONTH.format(new Date(`${m.month}-01T00:00:00Z`)),
                value: m.cents,
                display: formatMoney(m.cents),
                detail: `${m.count} ${m.count === 1 ? "deal" : "deals"}`,
                highlight: i === s.monthly.length - 1,
              }))}
            />
          </section>
          <section className="rounded-[var(--radius-card)] border border-line p-6">
            <h2 className="font-extrabold">Transactions</h2>
            <ul className="mt-3 divide-y divide-line">
              {s.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <Link href={`/business/${it.business_slug}`} className="block truncate font-bold hover:underline">{it.business_name}</Link>
                    <p className="truncate text-sm text-muted">{it.title} · {formatDateTime(it.redeemed_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-lime-ink tabular">+{formatMoney(it.savings_cents, { exact: it.savings_cents % 100 !== 0 })} saved</p>
                    <p className="text-xs text-muted tabular">paid {formatMoney(it.final_amount_cents, { exact: true })}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

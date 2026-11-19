import Link from "next/link";
import { getDb } from "@/server/db";
import { isDemo } from "@/server/env";
import { listActivity, listBusinessesAdmin, listDealsAdmin, listReports, platformStats } from "@/server/services/admin";
import { categoryName } from "@/lib/deals";
import { formatDateTime } from "@/lib/time";
import { cn, formatMoney, privateName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BusinessControls, DealControls, ReportControls, ResetDemo } from "./controls";

const TABS = [
  { key: "businesses", label: "Businesses" },
  { key: "deals", label: "Listings" },
  { key: "reports", label: "Reports" },
  { key: "activity", label: "Claims & redemptions" },
  { key: "log", label: "Audit & email log" },
];

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line bg-paper text-muted"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; f?: string }> }) {
  const { tab = "businesses", f } = await searchParams;
  const db = await getDb();
  const stats = await platformStats(db);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Platform</h1>
        {isDemo ? <ResetDemo /> : null}
      </div>
      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Platform stats">
        {[
          ["Users", stats.users], ["Businesses", stats.businesses], ["Pending reviews", stats.pending_reviews], ["Active subscriptions", stats.active_subscriptions],
          ["Live deals", stats.live_deals], ["Claims (7d)", stats.claims_7d], ["Redemptions (7d)", stats.redemptions_7d], ["Customer savings", formatMoney(stats.total_savings_cents)],
          ["Open reports", stats.open_reports], ["Emails not sent (no provider)", stats.emails_not_sent],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white p-4"><p className="text-xl font-extrabold tabular">{v}</p><p className="text-xs font-semibold text-muted">{k}</p></div>
        ))}
      </section>

      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={cn("h-9 shrink-0 rounded-full border px-4 text-sm leading-9 font-semibold", tab === t.key ? "border-ink bg-ink text-white" : "border-line bg-white")}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "businesses" ? <Businesses /> : tab === "deals" ? <Deals filter={(f as "all") ?? "all"} /> : tab === "reports" ? <Reports /> : tab === "activity" ? <Activity /> : <Log />}
      </div>
    </div>
  );

  async function Businesses() {
    const rows = await listBusinessesAdmin(db);
    return (
      <Table head={["Business", "Owner", "Review", "Subscription", "Deals", "Reports", ""]}>
        {rows.map((b) => (
          <tr key={b.id} className={b.suspended_at ? "bg-[#fde8e7]/40" : ""}>
            <td className="px-4 py-3"><Link href={`/business/${b.slug}`} className="font-semibold hover:underline">{b.name}</Link><p className="text-xs text-muted">{categoryName(b.category_slug)} · {b.zip} · joined {formatDateTime(b.created_at)}</p>{b.suspended_at ? <p className="text-xs font-semibold text-danger">Suspended: {b.suspended_reason}</p> : null}</td>
            <td className="px-4 py-3 text-muted">{b.owner_email}</td>
            <td className="px-4 py-3"><Badge size="sm" variant={b.review_status === "approved" ? "success" : b.review_status === "pending" ? "warning" : "danger"} className="capitalize">{b.review_status}</Badge></td>
            <td className="px-4 py-3"><span className="capitalize">{b.subscription_status ?? "none"}</span>{b.subscription_provider === "demo" || b.subscription_provider === "founding" ? <span className="text-xs text-muted"> ({b.subscription_provider === "founding" ? "free founding" : "demo"})</span> : null}</td>
            <td className="px-4 py-3 tabular">{b.deals}</td>
            <td className="px-4 py-3 tabular">{b.open_reports}</td>
            <td className="px-4 py-3"><BusinessControls id={b.id} review={b.review_status} suspended={!!b.suspended_at} /></td>
          </tr>
        ))}
      </Table>
    );
  }

  async function Deals({ filter }: { filter: "all" | "live" | "removed" | "reported" }) {
    const valid = ["all", "live", "removed", "reported"].includes(filter) ? filter : "all";
    const rows = await listDealsAdmin(db, valid);
    return (
      <>
        <div className="mb-3 flex gap-2 text-sm">
          {["all", "live", "reported", "removed"].map((k) => (
            <Link key={k} href={`/admin?tab=deals&f=${k}`} className={cn("rounded-full px-3 py-1 font-semibold capitalize", valid === k ? "bg-mist" : "text-muted")}>{k}</Link>
          ))}
        </div>
        <Table head={["Listing", "Business", "Status", "Claims", "Reports", "Ends", ""]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3"><Link href={`/deals/${d.id}`} className="font-semibold hover:underline">{d.title}</Link>{d.moderation_note ? <p className="text-xs text-danger">{d.moderation_note}</p> : null}</td>
              <td className="px-4 py-3">{d.business_name}</td>
              <td className="px-4 py-3">{d.moderation_removed_at ? <Badge size="sm" variant="danger">Removed</Badge> : <span className="capitalize">{d.status}</span>}</td>
              <td className="px-4 py-3 tabular">{d.claimed_count}</td>
              <td className="px-4 py-3 tabular">{d.open_reports}</td>
              <td className="px-4 py-3 text-muted">{formatDateTime(d.ends_at)}</td>
              <td className="px-4 py-3 text-right"><DealControls id={d.id} removed={!!d.moderation_removed_at} /></td>
            </tr>
          ))}
        </Table>
      </>
    );
  }

  async function Reports() {
    const rows = await listReports(db);
    if (!rows.length) return <p className="text-muted">No reports.</p>;
    return (
      <Table head={["Reported", "Reason", "Details", "Reporter", "Status", ""]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3">{r.deal_id ? <Link href={`/deals/${r.deal_id}`} className="font-semibold hover:underline">{r.deal_title}</Link> : null}<p className="text-xs text-muted">{r.business_name}</p></td>
            <td className="px-4 py-3 capitalize">{String(r.reason).replace("_", " ")}</td>
            <td className="max-w-xs px-4 py-3 text-muted">{r.details}</td>
            <td className="px-4 py-3">{privateName(r.reporter_name)}<p className="text-xs text-muted">{formatDateTime(r.created_at)}</p></td>
            <td className="px-4 py-3"><Badge size="sm" variant={r.status === "open" ? "warning" : "soft"} className="capitalize">{r.status}</Badge></td>
            <td className="px-4 py-3">{r.status === "open" ? <ReportControls id={r.id} /> : null}</td>
          </tr>
        ))}
      </Table>
    );
  }

  async function Activity() {
    const { claims } = await listActivity(db);
    return (
      <Table head={["Claimed", "Deal", "Business", "Customer", "Code", "Status", "Redeemed"]}>
        {claims.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3 text-muted">{formatDateTime(c.created_at)}</td>
            <td className="px-4 py-3 font-semibold">{c.title}</td>
            <td className="px-4 py-3">{c.business_name}</td>
            <td className="px-4 py-3">{privateName(c.customer_name)}</td>
            <td className="px-4 py-3 font-mono">{c.code}</td>
            <td className="px-4 py-3 capitalize">{c.status === "active" && new Date(c.expires_at) < new Date() ? "expired" : c.status}</td>
            <td className="px-4 py-3">{c.redeemed_at ? `${formatDateTime(c.redeemed_at)} · ${c.method} · saved ${formatMoney(c.savings_cents)}` : "—"}</td>
          </tr>
        ))}
      </Table>
    );
  }

  async function Log() {
    const { log, emails } = await listActivity(db);
    return (
      <div className="grid gap-6">
        <section>
          <h2 className="mb-2 font-extrabold">Audit log</h2>
          <Table head={["When", "Actor", "Action", "Entity", "Details"]}>
            {log.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-muted">{formatDateTime(l.created_at)}</td>
                <td className="px-4 py-2.5">{l.actor_name ?? "system"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{l.entity_type}</td>
                <td className="max-w-sm truncate px-4 py-2.5 font-mono text-xs text-muted">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-2 font-extrabold">Email log</h2>
          <p className="mb-2 text-sm text-muted">“not configured” means the email was not sent because Resend isn&apos;t set up.</p>
          <Table head={["When", "To", "Subject", "Status"]}>
            {emails.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5 text-muted">{formatDateTime(e.created_at)}</td>
                <td className="px-4 py-2.5">{e.to_email}</td>
                <td className="px-4 py-2.5">{e.subject}</td>
                <td className="px-4 py-2.5"><Badge size="sm" variant={e.status === "sent" ? "success" : e.status === "failed" ? "danger" : "soft"}>{String(e.status).replace("_", " ")}</Badge>{e.error ? <span className="ml-2 text-xs text-danger">{e.error}</span> : null}</td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    );
  }
}

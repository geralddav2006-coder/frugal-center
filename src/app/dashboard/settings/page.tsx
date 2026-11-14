import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { listTeam } from "@/server/services/merchant";
import { formatDate } from "@/lib/time";
import { PUBLIC_STATS_MIN, publicStats } from "@/lib/promo";
import { TeamManager } from "./team";
import { PublicStatsToggle } from "./public-stats";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { viewer, membership } = await requireBusiness("/dashboard/settings", ["owner", "manager"]);
  const db = await getDb();
  const team = await listTeam(db, membership.business_id);
  const [biz] = await db.query<{ show_public_stats: boolean; redeemed_count: number; saved_cents: number; created_at: Date }>(
    `select b.show_public_stats, b.created_at,
       (select count(*)::int from public.redemptions r where r.business_id = b.id) as redeemed_count,
       (select coalesce(sum(r.savings_cents), 0)::int from public.redemptions r where r.business_id = b.id) as saved_cents
     from public.businesses b where b.id = $1`,
    [membership.business_id],
  );
  const stats = publicStats({ ...biz!, show_public_stats: true });
  const preview = stats.redeemed
    ? `Customers see: “${stats.redeemed} deals redeemed${stats.saved ? ` · Customers saved ${stats.saved}` : ""}”`
    : `Shows once ${PUBLIC_STATS_MIN} deals have been redeemed (you have ${biz!.redeemed_count}). Counts are rounded, like “100+”.`;
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">Settings</h1>
      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Public profile stats</h2>
        <p className="mt-1 text-sm text-muted">Show customers how many deals have been redeemed at your business and how much they&apos;ve saved. It builds trust with new customers.</p>
        <PublicStatsToggle initial={biz!.show_public_stats} preview={preview} />
      </section>
      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Team</h2>
        <p className="mt-1 text-sm text-muted">Managers can create and edit deals. Staff can only redeem vouchers. Only the owner manages billing.</p>
        <TeamManager
          currentUserId={viewer.id}
          members={team.members.map((m) => ({ id: m.user_id, name: m.full_name ?? m.email, email: m.email, role: m.role, since: formatDate(m.created_at) }))}
          invites={team.invites.map((i) => ({ id: i.id, email: i.email, role: i.role }))}
        />
      </section>
    </div>
  );
}

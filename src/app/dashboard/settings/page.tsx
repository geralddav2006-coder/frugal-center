import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { listTeam } from "@/server/services/merchant";
import { formatDate } from "@/lib/time";
import { TeamManager } from "./team";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { viewer, membership } = await requireBusiness("/dashboard/settings", ["owner", "manager"]);
  const db = await getDb();
  const team = await listTeam(db, membership.business_id);
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">Settings</h1>
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

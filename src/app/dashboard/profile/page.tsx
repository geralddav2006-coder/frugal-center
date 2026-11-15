import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMerchantBusiness, listTeam } from "@/server/services/merchant";
import { listLaunchAreas } from "@/server/services/discovery";
import { BusinessForm } from "@/components/merchant/business-form";
import type { BusinessFormValue } from "@/components/merchant/business-defaults";
import { formatDate } from "@/lib/time";
import { TeamManager } from "./team";

export const metadata = { title: "Profile & Team" };

export default async function BusinessProfilePage() {
  const { viewer, membership } = await requireBusiness("/dashboard/profile", ["owner", "manager"]);
  const db = await getDb();
  const [b, areas, team] = await Promise.all([
    getMerchantBusiness(db, membership.business_id),
    listLaunchAreas(db),
    listTeam(db, membership.business_id),
  ]);
  const initial: BusinessFormValue = {
    name: b.name, category_slug: b.category_slug, description: b.description ?? "", address_line: b.address_line, city: b.city,
    state: b.state, zip: b.zip, lat: b.lat, lng: b.lng, phone: b.phone ?? "", website: b.website ?? "", contact_email: b.contact_email ?? "",
    hours: b.hours ?? {}, logo_url: b.logo_url, cover_url: b.cover_url,
  };
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Profile &amp; Team</h1>
        <Link href={`/business/${b.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"><ExternalLink className="size-4" aria-hidden /> View public profile</Link>
      </div>
      <BusinessForm mode="edit" initial={initial} areas={areas} />
      <section id="team" className="mt-8 scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
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

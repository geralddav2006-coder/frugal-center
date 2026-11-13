import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMerchantBusiness } from "@/server/services/merchant";
import { listLaunchAreas } from "@/server/services/discovery";
import { BusinessForm } from "@/components/merchant/business-form";
import type { BusinessFormValue } from "@/components/merchant/business-defaults";

export const metadata = { title: "Business Profile" };

export default async function BusinessProfilePage() {
  const { membership } = await requireBusiness("/dashboard/profile", ["owner", "manager"]);
  const db = await getDb();
  const [b, areas] = await Promise.all([getMerchantBusiness(db, membership.business_id), listLaunchAreas(db)]);
  const initial: BusinessFormValue = {
    name: b.name, category_slug: b.category_slug, description: b.description ?? "", address_line: b.address_line, city: b.city,
    state: b.state, zip: b.zip, lat: b.lat, lng: b.lng, phone: b.phone ?? "", website: b.website ?? "", contact_email: b.contact_email ?? "",
    hours: b.hours ?? {}, logo_url: b.logo_url, cover_url: b.cover_url,
  };
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Business Profile</h1>
        <Link href={`/business/${b.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"><ExternalLink className="size-4" aria-hidden /> View public profile</Link>
      </div>
      <BusinessForm mode="edit" initial={initial} areas={areas} />
    </div>
  );
}

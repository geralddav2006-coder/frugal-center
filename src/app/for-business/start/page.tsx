import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { listLaunchAreas } from "@/server/services/discovery";
import { Logo } from "@/components/brand";
import { BusinessForm } from "@/components/merchant/business-form";
import { EMPTY_BUSINESS } from "@/components/merchant/business-defaults";

export const metadata: Metadata = { title: "Set up your business" };

export default async function StartPage() {
  const viewer = await requireViewer("/for-business/start");
  if (viewer.memberships.some((m) => m.role === "owner")) redirect("/dashboard");
  const areas = await listLaunchAreas(await getDb());
  return (
    <div className="min-h-dvh bg-white sm:bg-paper">
      <header className="mx-auto flex h-16 max-w-2xl items-center justify-center px-4 sm:justify-start"><Logo suffix="for Business" /></header>
      <main className="mx-auto max-w-2xl px-5 pt-2 pb-16 sm:px-4">
        <div className="sm:rounded-[28px] sm:bg-white sm:p-10 sm:shadow-[var(--shadow-soft)]">
          <BusinessForm mode="onboarding" initial={{ ...EMPTY_BUSINESS, contact_email: viewer.email }} areas={areas} />
        </div>
        <p className="mt-6 hidden text-center text-sm text-muted sm:block">Next: activate your $29/month plan to start publishing deals. You can save drafts before subscribing.</p>
      </main>
    </div>
  );
}

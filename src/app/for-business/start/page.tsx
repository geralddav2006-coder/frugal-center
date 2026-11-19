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
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-2xl items-center px-4"><Logo suffix="for Business" /></header>
      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-10">
          <p className="text-sm font-semibold text-muted">Step-by-step · about 3 minutes</p>
          <BusinessForm mode="onboarding" initial={{ ...EMPTY_BUSINESS, contact_email: viewer.email }} areas={areas} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">Your first 3 months are free, with no card needed. You can start posting deals right after this step.</p>
      </main>
    </div>
  );
}

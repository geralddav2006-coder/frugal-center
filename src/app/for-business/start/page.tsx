import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { listLaunchAreas } from "@/server/services/discovery";
import { Logo } from "@/components/brand";
import { BusinessForm } from "@/components/merchant/business-form";
import { EMPTY_BUSINESS } from "@/components/merchant/business-defaults";

export const metadata: Metadata = { title: "Set up your business" };

export default async function StartPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  // ?preview=1 builds a private preview page for a business that hasn't joined yet (not linked anywhere).
  const preview = (await searchParams).preview === "1";
  const viewer = await requireViewer(preview ? "/for-business/start?preview=1" : "/for-business/start");
  if (!preview && viewer.memberships.some((m) => m.role === "owner" && !m.preview_token)) redirect("/dashboard");
  const areas = await listLaunchAreas(await getDb());
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-2xl items-center px-4"><Logo suffix="for Business" /></header>
      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-10">
          {preview ? (
            <p className="mb-4 rounded-xl bg-lime-soft p-3 text-sm font-semibold text-lime-ink">
              Private preview: only people with its link can see this page, and its deals can&apos;t be claimed until the owner claims it.
            </p>
          ) : null}
          <p className="text-sm font-semibold text-muted">Step-by-step · about 3 minutes</p>
          <BusinessForm mode="onboarding" initial={{ ...EMPTY_BUSINESS, contact_email: preview ? "" : viewer.email }} areas={areas} preview={preview} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">Your first 3 months are free, with no card needed. You can start posting deals right after this step.</p>
      </main>
    </div>
  );
}

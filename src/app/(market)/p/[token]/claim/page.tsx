import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getBusinessByPreviewToken } from "@/server/services/discovery";
import { BusinessAvatar } from "@/components/business-avatar";
import { ClaimPreviewButton } from "@/components/business/claim-preview-button";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Claim your page", robots: { index: false, follow: false } };

export default async function ClaimPreviewPage({ params }: Props) {
  const { token } = await params;
  const viewer = await getViewer();
  const data = await getBusinessByPreviewToken(await getDb(), token, await getViewerLocation(viewer), viewer?.id ?? null);
  if (!data) notFound();
  const b = data.business;
  const next = `/p/${token}/claim`;
  const built = viewer?.memberships.some((m) => m.business_id === b.id) ?? false;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-[28px] border border-line bg-white p-6 sm:p-8">
        <BusinessAvatar name={b.name} src={b.logo_url} className="size-16 rounded-2xl text-xl" />
        <h1 className="mt-4 text-2xl font-extrabold">Claim {b.name} on Frugal Center</h1>
        <ul className="mt-4 grid gap-2 text-[15px] text-ink/85">
          <li>• Your page is already built. You become its owner and can change anything.</li>
          <li>• The example deal is paused so you can review it. Customers see it once you tap Resume.</li>
          <li>• Free for your first 3 months, no card needed. No commission, ever.</li>
        </ul>
        <div className="mt-6 grid gap-3">
          {!viewer ? (
            <>
              <Button asChild size="lg"><Link href={`/signup?next=${encodeURIComponent(next)}`}>Create a free account to claim</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link></Button>
            </>
          ) : built ? (
            <p className="rounded-xl bg-paper p-3 text-sm text-muted">
              You built this preview. Send the owner this page&apos;s link so they can claim it from their own account.
            </p>
          ) : (
            <ClaimPreviewButton token={token} name={b.name} />
          )}
          <Button asChild variant="ghost"><Link href={`/p/${token}`}>Back to the preview</Link></Button>
        </div>
      </div>
    </div>
  );
}

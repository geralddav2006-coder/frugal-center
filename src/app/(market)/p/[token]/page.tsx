import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getBusinessByPreviewToken } from "@/server/services/discovery";
import { BusinessProfile } from "@/components/business/business-profile";

type Props = { params: Promise<{ token: string }> };

// Private: never indexed, never cached for others.
export const dynamic = "force-dynamic";

async function load(token: string) {
  const viewer = await getViewer();
  const loc = await getViewerLocation(viewer);
  return { viewer, data: await getBusinessByPreviewToken(await getDb(), token, loc, viewer?.id ?? null) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await load((await params).token);
  return {
    title: data ? `Preview for ${data.business.name}` : "Preview not found",
    robots: { index: false, follow: false },
  };
}

/** A private preview page built for a business that hasn't joined yet. Only people with the link can see it. */
export default async function PreviewPage({ params }: Props) {
  const { token } = await params;
  const { viewer, data } = await load(token);
  if (!data) notFound();
  return <BusinessProfile business={data.business} deals={data.deals} signedIn={!!viewer} previewToken={token} />;
}

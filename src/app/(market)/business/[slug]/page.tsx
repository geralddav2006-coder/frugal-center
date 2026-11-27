import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getBusinessBySlug } from "@/server/services/discovery";
import { categoryName } from "@/lib/deals";
import { BusinessProfile } from "@/components/business/business-profile";
import { SIGN_COOKIE } from "@/lib/promo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

async function load(slug: string) {
  const viewer = await getViewer();
  const loc = await getViewerLocation(viewer);
  return { viewer, data: await getBusinessBySlug(await getDb(), slug, loc, viewer?.id ?? null) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await load((await params).slug);
  if (!data) return { title: "Business not found" };
  const b = data.business;
  return {
    title: `${b.name} — deals in ${b.city}`,
    description: (b.description ?? `${categoryName(b.category_slug)} in ${b.city}`).slice(0, 160),
    openGraph: { images: b.cover_url ? [b.cover_url] : [] },
  };
}

export default async function BusinessPage({ params, searchParams }: Props) {
  const { viewer, data } = await load((await params).slug);
  if (!data) notFound();
  const { business: b, deals } = data;
  const sp = await searchParams;
  const fromSign = sp.from === "sign";
  // Auto-follow only right after signing up from the scan banner (the scan cookie proves they came from a sign).
  const scanned = (await cookies()).get(SIGN_COOKIE)?.value === b.id;
  const autoFollow = fromSign && sp.follow === "1" && !!viewer && !b.viewer_follows && scanned;
  return (
    <BusinessProfile business={b} deals={deals} signedIn={!!viewer} fromSign={fromSign} autoFollow={autoFollow} />
  );
}

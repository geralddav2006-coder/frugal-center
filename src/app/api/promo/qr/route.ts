import { NextResponse, type NextRequest } from "next/server";
import { getActiveMembership, getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { getPromoBusiness } from "@/server/services/promote";
import { qrPng } from "@/server/promo-qr";
import { isPromoPiece, promoUrl } from "@/lib/promo";

/** Download the business's QR code as a PNG, for their own flyers, menus or social posts. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  const membership = viewer ? await getActiveMembership(viewer) : null;
  if (!membership) return NextResponse.json({ error: "Sign in to your business account." }, { status: 401 });
  const biz = await getPromoBusiness(await getDb(), membership.business_id);
  if (!biz) return NextResponse.json({ error: "Business not found." }, { status: 404 });
  const p = req.nextUrl.searchParams.get("p");
  const png = await qrPng(promoUrl(env.appUrl, biz.slug, isPromoPiece(p) ? p : "link"));
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="frugal-center-qr-${biz.slug}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { recordPromoScan } from "@/server/services/promote";
import { SIGN_COOKIE, isPromoPiece } from "@/lib/promo";

// Link previews and crawlers shouldn't count as scans.
const BOT = /bot|crawl|spider|preview|facebookexternalhit|slack|whatsapp|telegram|discord|embedly|curl|wget/i;

/**
 * QR code target on a business's printed signs: /f/<slug>?p=counter
 * Counts the scan, remembers it briefly (to credit a follow), and opens the business page.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = req.nextUrl.searchParams.get("p");
  const piece = isPromoPiece(p) ? p : "other";
  const db = await getDb();

  const prev = req.cookies.get(SIGN_COOKIE)?.value;
  const ua = req.headers.get("user-agent") ?? "";
  const lookup = await recordPromoScan(db, slug, piece, false);
  if (!lookup) return NextResponse.redirect(new URL("/", req.url));
  // One scan per person per 30 minutes, ignoring bots.
  if (prev !== lookup.id && !BOT.test(ua)) await recordPromoScan(db, slug, piece, true);

  const res = NextResponse.redirect(new URL(`/business/${lookup.slug}?from=sign`, req.url));
  res.cookies.set(SIGN_COOKIE, lookup.id, { httpOnly: true, sameSite: "lax", maxAge: 30 * 60, path: "/" });
  return res;
}

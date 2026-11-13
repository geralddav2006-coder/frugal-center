import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { applyUnsubscribe, verifyUnsubscribe } from "@/server/services/notify";

/** RFC 8058 one-click unsubscribe (mail clients POST here). */
export async function POST(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const target = verifyUnsubscribe(s, sig);
  if (!target) return NextResponse.json({ ok: false }, { status: 400 });
  await applyUnsubscribe(await getDb(), target.userId, target.businessId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL(`/unsubscribe${req.nextUrl.search}`, req.url));
}

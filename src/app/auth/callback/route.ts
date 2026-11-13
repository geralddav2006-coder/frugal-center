import { NextResponse, type NextRequest } from "next/server";
import { integrations } from "@/server/env";

/** Supabase OAuth / email-confirmation callback: exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (integrations.supabase && code) {
    const { supabaseServer } = await import("@/server/supabase");
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}

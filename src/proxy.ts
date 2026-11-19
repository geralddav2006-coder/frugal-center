import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, integrations } from "@/server/env";

/**
 * Keeps Supabase auth cookies fresh (Supabase mode only). Authorization is
 * enforced in server code, not here.
 */
export async function proxy(request: NextRequest) {
  if (!integrations.supabase) return NextResponse.next();
  const url = env.supabaseUrl!;
  const key = env.supabaseAnonKey!;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/uploads|api/stripe|api/cron|api/health|icon.svg|logo-mark.svg|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/** Per-request Supabase client bound to the auth cookies (Supabase mode only). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client for Storage uploads. Never expose to the browser. */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, { auth: { persistSession: false } });
}

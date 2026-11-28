"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run } from "@/server/action";
import { signIn, signOut, signUp } from "@/server/auth";
import { env, integrations } from "@/server/env";
import { DomainError } from "@/server/services/common";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function signInAction(_: unknown, form: FormData) {
  const next = safeNext(form.get("next"));
  const res = await run(async () => {
    await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    return {};
  });
  if (!res.ok) return res;
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(_: unknown, form: FormData) {
  const next = safeNext(form.get("next"));
  const res = await run(async () =>
    signUp({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
    }),
  );
  if (!res.ok) return res;
  if (res.needsEmailConfirmation) return { ok: true as const, needsEmailConfirmation: true };
  revalidatePath("/", "layout");
  redirect(next === "/" ? "/?welcome=1" : next);
}

export async function signOutAction() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Hand this phone to a business owner: sign the current person out and open sign-up, then continue to `next`. */
export async function handOffToOwnerAction(form: FormData) {
  const next = safeNext(form.get("next"));
  await signOut();
  revalidatePath("/", "layout");
  redirect(`/signup?next=${encodeURIComponent(next)}`);
}

export async function googleSignInAction(next: string) {
  const res = await run(async () => {
    if (!integrations.supabase || !env.googleAuthEnabled) throw new DomainError("unavailable", "Google sign-in isn't enabled.");
    const { supabaseServer } = await import("@/server/supabase");
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
    });
    if (error || !data.url) throw new DomainError("auth", "Couldn't start Google sign-in.");
    return { url: data.url };
  });
  if (res.ok) redirect(res.url);
  return res;
}

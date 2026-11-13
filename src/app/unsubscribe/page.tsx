import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailX } from "lucide-react";
import { getDb } from "@/server/db";
import { applyUnsubscribe, verifyUnsubscribe } from "@/server/services/notify";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

async function confirm(form: FormData) {
  "use server";
  const s = String(form.get("s") ?? "");
  const sig = String(form.get("sig") ?? "");
  const target = verifyUnsubscribe(s, sig);
  if (target) await applyUnsubscribe(await getDb(), target.userId, target.businessId);
  redirect(`/unsubscribe?done=1&s=${encodeURIComponent(s)}&sig=${encodeURIComponent(sig)}`);
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ s?: string; sig?: string; done?: string }> }) {
  const { s, sig, done } = await searchParams;
  const target = s && sig ? verifyUnsubscribe(s, sig) : null;
  let businessName: string | null = null;
  if (target?.businessId) {
    const [b] = await (await getDb()).query<{ name: string }>(`select name from public.businesses where id = $1`, [target.businessId]);
    businessName = b?.name ?? null;
  }
  const what = businessName ? `new-deal notifications from ${businessName}` : "new-deal emails";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 text-center">
      <Logo />
      <div className="mt-8 grid size-14 place-items-center rounded-2xl bg-white shadow-[var(--shadow-soft)]"><MailX className="size-6" /></div>
      {!target ? (
        <>
          <h1 className="mt-4 text-2xl font-extrabold">This link isn&apos;t valid</h1>
          <p className="mt-2 max-w-sm text-muted">The unsubscribe link is incomplete or has been altered. You can manage notifications from your profile.</p>
        </>
      ) : done ? (
        <>
          <h1 className="mt-4 text-2xl font-extrabold">You&apos;re unsubscribed</h1>
          <p className="mt-2 max-w-sm text-muted">You won&apos;t receive {what} anymore. You can change this any time in your profile.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-extrabold">Unsubscribe from {what}?</h1>
          <form action={confirm} className="mt-6">
            <input type="hidden" name="s" value={s} />
            <input type="hidden" name="sig" value={sig} />
            <Button type="submit" size="lg">Unsubscribe</Button>
          </form>
        </>
      )}
      <Link href="/profile#notifications" className="mt-6 text-sm font-semibold underline-offset-4 hover:underline">Notification settings</Link>
    </div>
  );
}

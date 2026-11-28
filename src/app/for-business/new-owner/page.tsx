import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth";
import { Logo } from "@/components/brand";
import { HandOffButton } from "@/components/business/hand-off-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign up a business", robots: { index: false } };

const NEXT = "/for-business/start";

/** Sign a business up on the spot from your own phone: sign yourself out, then the owner creates their account. */
export default async function NewOwnerPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signup?next=${encodeURIComponent(NEXT)}`);
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-lg items-center px-4"><Logo /></header>
      <main className="mx-auto max-w-lg px-4 pb-16">
        <div className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <h1 className="text-2xl font-extrabold">Sign up a business on the spot</h1>
          <p className="mt-3 text-[15px] text-ink/85">
            You&apos;re signed in as <strong>{viewer.email}</strong>. The owner needs their own account, so this signs you out
            and opens sign-up. They set up their page and post a first deal in a few minutes. Sign back in afterward.
          </p>
          <div className="mt-6 grid gap-3">
            <HandOffButton next={NEXT} variant="lime">Sign out and hand the phone over</HandOffButton>
            <Button asChild variant="ghost"><Link href="/">Cancel</Link></Button>
          </div>
        </div>
      </main>
    </div>
  );
}

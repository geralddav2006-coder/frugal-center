import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { Logo } from "@/components/brand";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Logo href="/admin" />
          <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold tracking-wide text-lime uppercase">Admin</span>
          <nav className="ml-auto flex items-center gap-1 text-sm font-semibold">
            {viewer.memberships.length ? (
              <Link href="/dashboard" className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-mist" aria-label="Business dashboard">
                <LayoutDashboard className="size-4" aria-hidden /> <span className="hidden sm:inline">Business</span>
              </Link>
            ) : null}
            <Link href="/" className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-mist">
              <ArrowLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Back to Frugal Center</span><span className="sm:hidden">Site</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

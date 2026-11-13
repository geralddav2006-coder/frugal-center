import { requireAdmin } from "@/server/auth";
import { Logo } from "@/components/brand";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6"><Logo suffix="Admin" /></div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

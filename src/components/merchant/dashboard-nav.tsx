"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, CreditCard, LayoutDashboard, Megaphone, Menu, PlusCircle, ScanLine, Settings, Store, Tags, Users, X,
} from "lucide-react";
import { Dialog as D } from "radix-ui";
import { cn } from "@/lib/utils";

type Role = "owner" | "manager" | "staff";

export const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["owner", "manager", "staff"] },
  { href: "/dashboard/deals", label: "My Deals", icon: Tags, roles: ["owner", "manager", "staff"] },
  { href: "/dashboard/deals/new", label: "Create Deal", icon: PlusCircle, roles: ["owner", "manager"] },
  { href: "/dashboard/redeem", label: "Redeem", icon: ScanLine, roles: ["owner", "manager", "staff"] },
  { href: "/dashboard/followers", label: "Followers", icon: Users, roles: ["owner", "manager"] },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: ["owner", "manager"] },
  { href: "/dashboard/promote", label: "Promote", icon: Megaphone, roles: ["owner", "manager"] },
  { href: "/dashboard/profile", label: "Business Profile", icon: Store, roles: ["owner", "manager"] },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, roles: ["owner"] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["owner", "manager"] },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/deals") return pathname.startsWith("/dashboard/deals") && pathname !== "/dashboard/deals/new";
  return pathname.startsWith(href);
}

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="grid gap-0.5">
      {NAV.filter((n) => (n.roles as readonly string[]).includes(role)).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition", active ? "bg-ink text-white" : "text-ink/80 hover:bg-mist hover:text-ink")}>
            <Icon className={cn("size-[18px]", active && "text-lime")} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileDashboardNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const canCreate = role !== "staff";
  const primary = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/deals", label: "Deals", icon: Tags },
    ...(canCreate ? [{ href: "/dashboard/deals/new", label: "Create", icon: PlusCircle, special: true }] : []),
    { href: "/dashboard/redeem", label: "Redeem", icon: ScanLine },
  ] as { href: string; label: string; icon: typeof Tags; special?: boolean }[];
  return (
    <nav aria-label="Dashboard" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-lg lg:hidden">
      {/* Columns match the number of items (staff have 4, owners/managers 5) so buttons stay evenly spaced and centered */}
      <ul className="mx-auto grid max-w-md items-end" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
        {primary.map(({ href, label, icon: Icon, special }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 pt-2 pb-2 text-[11px] font-semibold">
                {special ? (
                  <span className="-mt-5 grid size-12 place-items-center rounded-full bg-lime text-ink shadow-[var(--shadow-lift)] ring-4 ring-white"><Icon className="size-6" aria-hidden /></span>
                ) : (
                  <span className={cn("relative grid h-7 w-12 place-items-center rounded-full", active ? "bg-ink text-lime" : "text-muted")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                )}
                <span className={active ? "text-ink" : "text-muted"}>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <D.Root open={open} onOpenChange={setOpen}>
            <D.Trigger className="flex w-full flex-col items-center gap-1 pt-2 pb-2 text-[11px] font-semibold text-muted">
              <span className="grid h-7 w-12 place-items-center"><Menu className="size-5" aria-hidden /></span> More
            </D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-50 bg-ink/40" />
              <D.Content className="pb-safe fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-4 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
                <div className="mb-2 flex items-center justify-between px-2">
                  <D.Title className="text-lg font-extrabold">Menu</D.Title>
                  <D.Description className="sr-only">Dashboard navigation</D.Description>
                  <D.Close className="grid size-9 place-items-center rounded-full hover:bg-mist" aria-label="Close"><X className="size-5" /></D.Close>
                </div>
                <div onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                  <Link href="/" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-muted hover:bg-mist">← Back to Frugal Center</Link>
                </div>
              </D.Content>
            </D.Portal>
          </D.Root>
        </li>
      </ul>
    </nav>
  );
}

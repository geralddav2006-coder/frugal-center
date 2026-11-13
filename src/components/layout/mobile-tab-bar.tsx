"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, PiggyBank, Ticket, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Explore", icon: Compass, match: (p: string) => p === "/" || p.startsWith("/explore") || p.startsWith("/deals") || p.startsWith("/business") },
  { href: "/following", label: "Following", icon: Heart, match: (p: string) => p.startsWith("/following") },
  { href: "/my-deals", label: "My Deals", icon: Ticket, match: (p: string) => p.startsWith("/my-deals") || p.startsWith("/vouchers") },
  { href: "/savings", label: "Savings", icon: PiggyBank, match: (p: string) => p.startsWith("/savings") },
  { href: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") || p.startsWith("/notifications") },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-lg md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold">
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active ? "bg-lime text-ink" : "text-muted")}>
                  <Icon className="size-[20px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                <span className={active ? "text-ink" : "text-muted"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

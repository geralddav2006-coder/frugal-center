"use client";
import Link from "next/link";
import { Bell, Flag, Heart, LayoutDashboard, LogOut, PiggyBank, ScanLine, Shield, Store, Ticket, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/auth";
import { initials } from "@/lib/utils";

export function ProfileMenu({ name, email, isAdmin, hasBusiness }: { name: string | null; email: string; isAdmin: boolean; hasBusiness: boolean }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account menu" className="grid size-10 place-items-center rounded-full bg-ink text-sm font-bold text-lime transition hover:ring-4 hover:ring-mist">
          {initials(name ?? email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate text-[15px] font-bold text-ink">{name ?? "Your account"}</span>
          <span className="block truncate font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild className="font-bold"><Link href="/admin"><Shield />Admin dashboard</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin?tab=reports"><Flag />Abuse reports</Link></DropdownMenuItem>
            {hasBusiness ? null : <DropdownMenuSeparator />}
          </>
        ) : null}
        {hasBusiness ? (
          <>
            <DropdownMenuItem asChild className="font-bold"><Link href="/dashboard"><LayoutDashboard />Business dashboard</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/dashboard/redeem"><ScanLine />Redeem a voucher</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild><Link href="/my-deals"><Ticket />My Deals</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/savings"><PiggyBank />Savings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/following"><Heart />Following</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/notifications"><Bell />Notifications</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/profile"><User />Profile & settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        {hasBusiness ? null : (
          <DropdownMenuItem asChild><Link href="/for-business"><Store />List your business</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOutAction()}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

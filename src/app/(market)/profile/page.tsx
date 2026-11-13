import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, Heart, LayoutDashboard, MapPin, PiggyBank, ScanLine, Shield, Store, Ticket } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { env, integrations } from "@/server/env";
import { getViewerLocation } from "@/server/location";
import { getPreferences } from "@/server/services/engagement";
import { listLaunchAreas } from "@/server/services/discovery";
import { formatDate } from "@/lib/time";
import { LocationPicker } from "@/components/layout/location-picker";
import { BusinessAvatar } from "@/components/business-avatar";
import { PreferencesForm, NameForm } from "./forms";
import { SignOutButton } from "./sign-out";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  const db = await getDb();
  const [prefs, loc, areas, [created]] = await Promise.all([
    getPreferences(db, viewer.id),
    getViewerLocation(viewer),
    listLaunchAreas(db),
    db.query<{ created_at: Date }>(`select created_at from public.profiles where id = $1`, [viewer.id]),
  ]);
  const links = [
    { href: "/my-deals", label: "Active vouchers", icon: Ticket },
    { href: "/my-deals?tab=saved", label: "Saved deals", icon: Heart },
    { href: "/my-deals?tab=history", label: "Redemption history", icon: Ticket },
    { href: "/savings", label: "Savings dashboard", icon: PiggyBank },
    { href: "/following", label: "Followed businesses", icon: Store },
    { href: "/notifications", label: "Notification center", icon: Bell },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-extrabold">Profile</h1>
      <p className="mt-1 text-muted">{viewer.email} · Member since {formatDate(created!.created_at)}</p>

      {viewer.memberships.length ? (
        <section className="mt-6 grid gap-3" aria-label="Your business">
          {viewer.memberships.map((m) => (
            <div key={m.business_id} className="rounded-[22px] bg-ink p-5 text-white">
              <div className="flex items-center gap-3">
                <BusinessAvatar name={m.name} src={m.logo_url} className="size-12 text-base" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/60">Your business · <span className="capitalize">{m.role}</span></p>
                  <p className="truncate text-lg font-extrabold">{m.name}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/dashboard" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-extrabold text-ink active:scale-[0.97]">
                  <LayoutDashboard className="size-4" aria-hidden /> Dashboard
                </Link>
                <Link href="/dashboard/redeem" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 text-[15px] font-semibold active:scale-[0.97]">
                  <ScanLine className="size-4" aria-hidden /> Redeem
                </Link>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-8 rounded-[var(--radius-card)] border border-line p-5">
        <h2 className="font-extrabold">Account</h2>
        <NameForm initial={viewer.fullName ?? ""} />
      </section>

      <section className="mt-5 rounded-[var(--radius-card)] border border-line p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><MapPin className="size-4" aria-hidden /> Location</h2>
        <p className="mt-1 text-sm text-muted">Deals are shown within {loc.radius} miles of this location.</p>
        <LocationPicker label={loc.label} radius={loc.radius} areas={areas} className="-ml-3 mt-2" />
      </section>

      <section id="notifications" className="mt-5 scroll-mt-24 rounded-[var(--radius-card)] border border-line p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><Bell className="size-4" aria-hidden /> Notifications</h2>
        <p className="mt-1 text-sm text-muted">When businesses you follow post a new deal. You can also mute individual businesses on the Following page.</p>
        <PreferencesForm
          initial={prefs}
          pushConfigured={integrations.push}
          vapidKey={env.vapidPublicKey ?? null}
          emailConfigured={integrations.resend}
        />
      </section>

      <nav className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line" aria-label="Your account">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 border-b border-line px-5 py-4 font-semibold last:border-0 hover:bg-paper">
            <Icon className="size-5 text-muted" aria-hidden /> {label} <ChevronRight className="ml-auto size-4 text-muted" aria-hidden />
          </Link>
        ))}
      </nav>

      <nav className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line" aria-label="Other">
        {viewer.memberships.length ? (
          <Link href="/dashboard" className="flex items-center gap-3 border-b border-line px-5 py-4 font-semibold last:border-0 hover:bg-paper">
            <LayoutDashboard className="size-5 text-muted" aria-hidden /> Business dashboard <ChevronRight className="ml-auto size-4 text-muted" aria-hidden />
          </Link>
        ) : (
          <Link href="/for-business" className="flex items-center gap-3 border-b border-line px-5 py-4 font-semibold last:border-0 hover:bg-paper">
            <Store className="size-5 text-muted" aria-hidden /> List your business <ChevronRight className="ml-auto size-4 text-muted" aria-hidden />
          </Link>
        )}
        {viewer.isAdmin ? (
          <Link href="/admin" className="flex items-center gap-3 px-5 py-4 font-semibold hover:bg-paper">
            <Shield className="size-5 text-muted" aria-hidden /> Admin <ChevronRight className="ml-auto size-4 text-muted" aria-hidden />
          </Link>
        ) : null}
      </nav>

      <div className="mt-8"><SignOutButton /></div>
    </div>
  );
}

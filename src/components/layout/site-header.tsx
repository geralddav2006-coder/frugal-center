import Link from "next/link";
import { Suspense } from "react";
import { Bell, Search, Shield, Store } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { listLaunchAreas } from "@/server/services/discovery";
import { unreadCount } from "@/server/services/notify";
import { Logo, LogoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "./location-picker";
import { ProfileMenu } from "./profile-menu";
import { SearchBox } from "./search-box";

export async function SiteHeader() {
  const viewer = await getViewer();
  const db = await getDb();
  const [loc, areas, unread] = await Promise.all([
    getViewerLocation(viewer),
    listLaunchAreas(db),
    viewer ? unreadCount(db, viewer.id) : Promise.resolve(0),
  ]);
  const isMember = !!viewer?.memberships.length;
  const isAdmin = !!viewer?.isAdmin;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-lg md:hidden" aria-label="Frugal Center home">
          <LogoMark className="size-9" />
        </Link>
        <Logo className="hidden md:flex" />
        <LocationPicker label={loc.label} radius={loc.radius} areas={areas} compact={isMember || isAdmin ? "tight" : true} className="md:ml-3" />
        <div className="mx-4 hidden max-w-md flex-1 lg:block">
          <Suspense>
            <SearchBox />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {isMember || isAdmin ? null : (
            <Link href="/for-business" className="mr-2 hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-mist xl:block">
              For businesses
            </Link>
          )}
          <Button asChild variant="ghost" size="icon" className={isMember || isAdmin ? "hidden sm:inline-flex lg:hidden" : "lg:hidden"}>
            <Link href="/explore?focus=1" aria-label="Search"><Search className="size-5" /></Link>
          </Button>
          {viewer ? (
            <>
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                  <Bell className="size-5" />
                  {unread ? (
                    <span className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-lime px-1 text-[10px] leading-[18px] font-extrabold text-ink ring-2 ring-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>
              {isAdmin ? (
                <Button asChild size="sm" variant="outline" className={isMember ? "ml-1 gap-1.5 px-2.5 sm:px-3.5" : "ml-1 gap-1.5 px-3.5"}>
                  <Link href="/admin" aria-label="Admin dashboard">
                    <Shield aria-hidden />
                    <span className={isMember ? "hidden sm:inline" : undefined}>Admin</span>
                  </Link>
                </Button>
              ) : null}
              {isMember ? (
                <Button asChild size="sm" className="ml-1 gap-1.5 px-3.5">
                  <Link href="/dashboard" aria-label="Business dashboard">
                    <Store className="text-lime" aria-hidden />
                    <span className="lg:hidden">Business</span>
                    <span className="hidden lg:inline">Business dashboard</span>
                  </Link>
                </Button>
              ) : null}
              <div className="ml-1 hidden md:block">
                <ProfileMenu name={viewer.fullName} email={viewer.email} isAdmin={viewer.isAdmin} hasBusiness={viewer.memberships.length > 0} />
              </div>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/signup">Sign up</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

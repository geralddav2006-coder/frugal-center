import Link from "next/link";
import { Suspense } from "react";
import { Bell, CalendarClock, Clock, Heart, MapPin, Sparkles, Store, Zap } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getHomeSections, type DealCard as Deal } from "@/server/services/discovery";
import { scheduleDueDispatch } from "@/server/sweep";
import { CATEGORIES } from "@/lib/deals";
import { DealCard } from "@/components/deals/deal-card";
import { DealRail } from "@/components/deals/deal-rail";
import { CategoryBar } from "@/components/deals/category-bar";
import { ViewToggle } from "@/components/deals/view-toggle";
import { SearchBox } from "@/components/layout/search-box";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/welcome-toast";
import { Button } from "@/components/ui/button";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const category = CATEGORIES.some((c) => c.slug === sp.category) ? sp.category : undefined;
  const viewer = await getViewer();
  const loc = await getViewerLocation(viewer);
  const db = await getDb();
  const s = await getHomeSections(db, { lat: loc.lat, lng: loc.lng, radiusMiles: loc.radius }, viewer?.id ?? null, category);
  scheduleDueDispatch();

  const signedIn = !!viewer;
  const rail = (deals: Deal[], priority = false) =>
    deals.map((d, i) => <DealCard key={d.id} deal={d} signedIn={signedIn} size="rail" priority={priority && i < 2} />);
  const explore = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(category ? { category } : {}), ...extra });
    return `/explore?${p.toString()}`;
  };
  const nothingNearby = s.nearYou.length === 0;

  return (
    <>
      <Suspense>
        <FlashToast param="welcome" message="Welcome to Frugal Center! Start exploring deals near you." />
      </Suspense>
      <section className="bg-[linear-gradient(180deg,#fafaf7_0%,#ffffff_100%)]">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-4 sm:px-6 sm:pt-14 lg:px-8">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-[var(--shadow-soft)]">
            <MapPin className="size-3.5" aria-hidden /> {loc.label} · within {loc.radius} mi
          </p>
          <h1 className="max-w-3xl text-[33px] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-6xl lg:text-7xl">
            Good deals, <span className="marker">close to home.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[17px] text-muted sm:text-lg">Discover exclusive discounts from local businesses.</p>
          <Suspense>
            <SearchBox size="hero" className="mt-7 max-w-2xl" />
          </Suspense>
        </div>
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-2 sm:px-4 lg:px-6">
          <CategoryBar basePath="/" params={{}} active={category ?? "all"} className="min-w-0 flex-1" />
          <ViewToggle view="list" listHref="/" mapHref={explore({ view: "map" })} className="mb-3 hidden shrink-0 sm:inline-flex" />
        </div>
        <div className="border-b border-line" />
      </section>

      <div className="mx-auto max-w-7xl pt-2">
        <div className="flex justify-end px-4 pt-3 sm:hidden">
          <ViewToggle view="list" listHref="/" mapHref={explore({ view: "map" })} />
        </div>

        {nothingNearby ? (
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <EmptyState
              icon={<MapPin />}
              title={category ? "No deals in this category nearby yet" : "No deals near this location yet"}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {category ? <Button asChild variant="outline"><Link href="/">Show all categories</Link></Button> : null}
                  <Button asChild><Link href="/explore?radius=25">Search a wider area</Link></Button>
                </div>
              }
            >
              Frugal Center is launching in Austin first. Try a wider radius or pick an Austin neighborhood from the location menu.
            </EmptyState>
          </div>
        ) : (
          <>
            <DealRail title="Deals Near You" subtitle={`Closest first, within ${loc.radius} miles`} href={explore({ sort: "nearest" })} icon={<MapPin className="size-5" aria-hidden />}>
              {rail(s.nearYou, true)}
            </DealRail>

            {s.endingSoon.length ? (
              <DealRail title="Ending Soon" subtitle="Grab these before they're gone" href={explore({ sort: "ending" })} icon={<Clock className="size-5" aria-hidden />}>
                {rail(s.endingSoon)}
              </DealRail>
            ) : null}

            {s.newToday.length ? (
              <DealRail title="New Today" subtitle="Posted in the last 24 hours" href={explore({ sort: "newest" })} icon={<Sparkles className="size-5" aria-hidden />}>
                {rail(s.newToday)}
              </DealRail>
            ) : null}

            {s.lastMinute.length ? (
              <DealRail title="Last-Minute Appointments" subtitle="Canceled and unbooked slots in the next 48 hours" href="/explore?lastMinute=1&type=appointment" icon={<CalendarClock className="size-5" aria-hidden />}>
                {rail(s.lastMinute)}
              </DealRail>
            ) : null}

            <FollowedSection signedIn={signedIn} following={s.following} followingCount={s.followingCount} rail={rail} />

            {s.recommended.length ? (
              <DealRail title="Recommended for You" subtitle={s.recommendedReason} href={explore({ sort: "discount" })} icon={<Zap className="size-5" aria-hidden />}>
                {rail(s.recommended)}
              </DealRail>
            ) : null}
          </>
        )}

        <section className="px-4 pt-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[28px] bg-ink p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-lime"><Store className="size-4" aria-hidden /> For local businesses</p>
              <h2 className="mt-2 max-w-lg text-2xl font-extrabold sm:text-3xl">Turn empty time slots and unsold inventory into revenue.</h2>
              <p className="mt-2 text-white/70">$29/month. Unlimited deals. Zero commissions.</p>
            </div>
            <Button asChild variant="lime" size="lg"><Link href="/for-business">Start listing deals</Link></Button>
          </div>
        </section>
      </div>
    </>
  );
}

function FollowedSection({
  signedIn,
  following,
  followingCount,
  rail,
}: {
  signedIn: boolean;
  following: Deal[];
  followingCount: number;
  rail: (d: Deal[]) => React.ReactNode;
}) {
  if (following.length) {
    return (
      <DealRail title="Businesses You Follow" subtitle="Live deals from your favorite places" href="/following" icon={<Heart className="size-5" aria-hidden />}>
        {rail(following)}
      </DealRail>
    );
  }
  return (
    <section className="px-4 py-5 sm:px-6 lg:px-8" aria-label="Businesses You Follow">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold sm:text-[22px]"><Heart className="size-5" aria-hidden /> Businesses You Follow</h2>
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime"><Bell className="size-5" aria-hidden /></div>
        <div className="flex-1">
          <p className="font-bold">{signedIn && followingCount ? "Nothing live from places you follow right now" : "Never miss a deal from your favorite spots"}</p>
          <p className="text-sm text-muted">
            {signedIn && followingCount
              ? "We'll notify you the moment they post something new."
              : "Follow a business and we'll let you know when they post a new deal."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={signedIn ? "/following" : "/signup?next=/following"}>{signedIn ? "Find businesses" : "Create free account"}</Link>
        </Button>
      </div>
    </section>
  );
}

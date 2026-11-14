import Link from "next/link";
import { Suspense } from "react";
import { Bell, CalendarClock, Check, Clock, Gem, Heart, Map, MapPin, Sparkles, Store, Zap } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getHomeSections, nearbyStats, type DealCard as Deal } from "@/server/services/discovery";
import { scheduleDueDispatch } from "@/server/sweep";
import { CATEGORIES, priceDisplay } from "@/lib/deals";
import { formatDistance } from "@/lib/utils";
import { SmartImage } from "@/components/smart-image";
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
  const [s, stats] = await Promise.all([
    getHomeSections(db, { lat: loc.lat, lng: loc.lng, radiusMiles: loc.radius }, viewer?.id ?? null, category),
    nearbyStats(db, loc, loc.radius, category),
  ]);
  scheduleDueDispatch();
  const livePicks = (s.endingSoon.length >= 3 ? s.endingSoon : s.nearYou).slice(0, 3);

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
      <section className="bg-paper">
        <div className="mx-auto max-w-7xl px-5 pt-6 pb-5 sm:px-6 sm:pt-14 sm:pb-6 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-center lg:gap-12 lg:px-8">
          <div className="min-w-0">
          <Link
            href="/explore"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white py-1.5 pr-3.5 pl-2.5 text-[13px] font-semibold shadow-[var(--shadow-soft)] transition hover:border-ink"
          >
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              {stats.count ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-75" /> : null}
              <span className="relative inline-flex size-2.5 rounded-full bg-lime" />
            </span>
            <span className="truncate">
              {stats.count
                ? `${stats.count} ${stats.count === 1 ? "deal" : "deals"} live near ${loc.label}`
                : `New deals coming to ${loc.label}`}
            </span>
          </Link>
          <h1 className="mt-4 text-[34px] leading-[1.04] font-extrabold tracking-[-0.02em] min-[400px]:text-[37px] sm:mt-5 sm:text-6xl lg:text-[76px]">
            Good deals,
            <br />
            <span className="text-lime-ink">close to home.</span>
          </h1>
          <p className="mt-3 max-w-[36ch] text-[16px] leading-relaxed text-muted sm:mt-4 sm:max-w-xl sm:text-lg">
            Leftover bakes, last-minute appointments and quiet-hour specials from local spots. Free to claim, pay in store.
          </p>
          <Suspense>
            <SearchBox size="hero" className="mt-5 max-w-2xl sm:mt-7" />
          </Suspense>
          {/* Phones: three equal tiles in one row, so it never wraps 2 + 1. Larger screens: one inline row. */}
          <ul className="mt-4 grid max-w-2xl grid-cols-3 gap-2 text-[12.5px] leading-tight font-semibold text-ink/75 sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1.5 sm:text-[13px]" aria-label="Why Frugal Center">
            {["Free to claim", stats.maxPct >= 10 ? `Up to ${stats.maxPct}% off` : "Local discounts", "Pay in store"].map((t) => (
              <li key={t} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-white px-1 py-2.5 text-center text-balance sm:flex-row sm:gap-1.5 sm:border-0 sm:bg-transparent sm:p-0 sm:text-left">
                <span className="grid size-5 place-items-center rounded-full bg-lime-soft sm:contents">
                  <Check className="size-3.5 text-lime-ink sm:size-4" strokeWidth={2.75} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
          </div>
          {livePicks.length ? (
            <aside className="hidden rounded-[26px] border border-line bg-white p-5 shadow-[var(--shadow-soft)] lg:block" aria-label="Live right now">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <span className="relative flex size-2.5" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-lime" />
                  </span>
                  Live right now
                </p>
                <Link href={explore({ sort: "ending" })} className="text-sm font-bold text-lime-ink hover:underline">See all</Link>
              </div>
              <ul className="grid gap-2">
                {livePicks.map((d) => {
                  const p = priceDisplay(d);
                  return (
                    <li key={d.id}>
                      <Link href={`/deals/${d.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-paper">
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-mist">
                          <SmartImage src={d.images[0] ?? d.business_cover} alt="" sizes="64px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-muted">{d.business_name}{formatDistance(d.distance_miles) ? ` · ${formatDistance(d.distance_miles)}` : ""}</p>
                          <p className="truncate font-bold">{d.title}</p>
                          <p className="text-sm">
                            <span className="font-extrabold">{p.headline}</span>{" "}
                            {p.original ? <span className="text-muted line-through">{p.original}</span> : null}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-lime px-2.5 py-1 text-[11px] font-extrabold">{p.badge}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </aside>
          ) : null}
        </div>
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-2 sm:px-4 lg:px-6">
          <CategoryBar basePath="/" params={{}} active={category ?? "all"} className="min-w-0 flex-1" />
          <ViewToggle view="list" listHref="/" mapHref={explore({ view: "map" })} className="mb-3 hidden shrink-0 sm:inline-flex" />
        </div>
        <div className="border-b border-line" />
      </section>

      <div className="mx-auto max-w-7xl pt-2">
        <Link
          href={explore({ view: "map" })}
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-30 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-bold text-white shadow-[var(--shadow-lift)] active:scale-95 sm:hidden"
        >
          <Map className="size-4 text-lime" aria-hidden /> Map
        </Link>

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

            {s.exclusives.length ? (
              <DealRail title="Exclusives" subtitle="Deals you'll only find on Frugal Center" href={explore({ exclusive: "1" })} icon={<Gem className="size-5 text-lime-ink" aria-hidden />}>
                {rail(s.exclusives)}
              </DealRail>
            ) : null}

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

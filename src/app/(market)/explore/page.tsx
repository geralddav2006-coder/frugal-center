import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { listLiveDeals, type SortKey } from "@/server/services/discovery";
import { CATEGORIES, categoryName, priceDisplay, type DealType } from "@/lib/deals";
import { formatDistance, pluralize } from "@/lib/utils";
import { DealCard } from "@/components/deals/deal-card";
import { CategoryBar } from "@/components/deals/category-bar";
import { ViewToggle } from "@/components/deals/view-toggle";
import { FilterBar } from "@/components/deals/filter-bar";
import { DealsMap } from "@/components/deals/deals-map";
import { SearchBox } from "@/components/layout/search-box";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Explore deals" };

type SP = Record<string, string | undefined>;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const loc = await getViewerLocation(viewer);
  const category = CATEGORIES.some((c) => c.slug === sp.category) ? sp.category : undefined;
  const sort = (["nearest", "ending", "newest", "discount"] as SortKey[]).includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "nearest";
  const type = (["surplus", "appointment", "slow_hours"] as DealType[]).includes(sp.type as DealType) ? (sp.type as DealType) : undefined;
  const radius = [1, 3, 5, 10, 25].includes(Number(sp.radius)) ? Number(sp.radius) : loc.radius;
  const maxPrice = [10, 25, 50].includes(Number(sp.maxPrice)) ? Number(sp.maxPrice) * 100 : undefined;
  const view = sp.view === "map" ? "map" : "list";
  const exclusive = sp.exclusive === "1";

  const deals = await listLiveDeals(
    await getDb(),
    loc,
    { q: sp.q, category, sort, type, radiusMiles: radius, maxPriceCents: maxPrice, lastMinute: sp.lastMinute === "1", exclusive, limit: 120 },
    viewer?.id ?? null,
  );

  const keep: SP = { q: sp.q, sort: sp.sort, type: sp.type, radius: sp.radius, maxPrice: sp.maxPrice, category: sp.category, lastMinute: sp.lastMinute, exclusive: sp.exclusive };
  const qs = (extra: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...extra })) if (v) p.set(k, v);
    return `/explore?${p.toString()}`;
  };
  const heading = sp.q
    ? `Results for “${sp.q}”`
    : exclusive
      ? "Frugal Center Exclusives"
      : sp.lastMinute === "1"
        ? "Last-minute deals"
        : category
          ? categoryName(category)
          : "All deals";

  return (
    <div>
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
          <Suspense>
            <SearchBox className="max-w-2xl lg:hidden" autoFocus={sp.focus === "1"} />
          </Suspense>
          <CategoryBar basePath="/explore" params={keep} active={exclusive ? "exclusive" : sp.lastMinute === "1" ? "last-minute" : (category ?? "all")} className="-mx-2 mt-3" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{heading}</h1>
            <p className="mt-1 text-sm text-muted">
              {exclusive ? "Offers local businesses run only on Frugal Center. " : ""}
              {pluralize(deals.length, "deal")} within {radius} mi of {loc.label}
            </p>
          </div>
          <ViewToggle view={view} listHref={qs({ view: undefined })} mapHref={qs({ view: "map" })} />
        </div>
        <div className="mt-4">
          <Suspense>
            <FilterBar defaultRadius={loc.radius} />
          </Suspense>
        </div>

        {deals.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<SearchX />}
            title="No deals match right now"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline"><Link href="/explore">Clear filters</Link></Button>
                {radius < 25 ? <Button asChild><Link href={qs({ radius: "25" })}>Search within 25 mi</Link></Button> : null}
              </div>
            }
          >
            Try a different search, a wider distance, or follow businesses to hear about new deals first.
          </EmptyState>
        ) : view === "map" ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <DealsMap
              className="h-[62dvh] rounded-[var(--radius-card)] border border-line lg:order-2 lg:h-[calc(100dvh-14rem)] lg:sticky lg:top-24"
              center={{ lat: loc.lat, lng: loc.lng }}
              deals={deals.map((d) => {
                const p = priceDisplay(d);
                return { id: d.id, lat: d.lat, lng: d.lng, price: p.variable ? p.badge : p.headline, original: p.original, title: d.title, business: d.business_name, image: d.images[0] ?? d.business_cover, distance: formatDistance(d.distance_miles) };
              })}
            />
            <div className="grid content-start gap-x-5 gap-y-8 sm:grid-cols-2 lg:order-1 lg:grid-cols-1 xl:grid-cols-2">
              {deals.map((d) => <DealCard key={d.id} deal={d} signedIn={!!viewer} />)}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {deals.map((d, i) => <DealCard key={d.id} deal={d} signedIn={!!viewer} priority={i < 2} />)}
          </div>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Store } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { listFollowing, listSuggestedBusinesses } from "@/server/services/engagement";
import { categoryName } from "@/lib/deals";
import { pluralize } from "@/lib/utils";
import { BusinessAvatar } from "@/components/business-avatar";
import { FollowButton } from "@/components/follow-button";
import { SmartImage } from "@/components/smart-image";
import { EmptyState } from "@/components/empty-state";
import { NotifyToggle } from "./notify-toggle";

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage() {
  const viewer = await requireViewer("/following");
  const db = await getDb();
  const [following, suggested] = await Promise.all([listFollowing(db, viewer.id), listSuggestedBusinesses(db, viewer.id, 6)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="text-3xl font-extrabold">Following</h1>
      <p className="mt-1 text-muted">Get notified the moment your favorite places post a deal. <Link href="/profile#notifications" className="font-semibold text-ink underline-offset-4 hover:underline">Notification settings</Link></p>

      {following.length ? (
        <ul className="mt-6 grid gap-3">
          {following.map((b) => (
            <li key={b.business_id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-line p-4">
              <Link href={`/business/${b.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                <BusinessAvatar name={b.name} src={b.logo_url} className="size-14 text-lg" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{b.name}</p>
                  <p className="truncate text-sm text-muted">{categoryName(b.category_slug)}{b.neighborhood ? ` · ${b.neighborhood}` : ""}</p>
                  <p className={b.live_deals ? "text-sm font-semibold text-lime-ink" : "text-sm text-muted"}>
                    {b.live_deals ? `${pluralize(b.live_deals, "live deal")}` : "No live deals right now"}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <NotifyToggle businessId={b.business_id} name={b.name} initial={b.notify} />
                <FollowButton businessId={b.business_id} businessName={b.name} initial signedIn size="sm" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon={<Heart />} title="You're not following anyone yet">
          Follow businesses you love and we&apos;ll tell you when they post new deals — even when they have nothing live today.
        </EmptyState>
      )}

      {suggested.length ? (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Store className="size-5" aria-hidden /> Popular near you</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.map((b) => (
              <div key={b.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line">
                <Link href={`/business/${b.slug}`} className="relative block h-28 bg-mist">
                  <SmartImage src={b.cover_url} alt="" sizes="400px" fallbackLabel={b.name} />
                </Link>
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/business/${b.slug}`} className="block truncate font-bold hover:underline">{b.name}</Link>
                    <p className="text-sm text-muted">{categoryName(b.category_slug)} · {pluralize(b.followers, "follower")}</p>
                  </div>
                  <FollowButton businessId={b.id} businessName={b.name} initial={false} signedIn size="sm" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

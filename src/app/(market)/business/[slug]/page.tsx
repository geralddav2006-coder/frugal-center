import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Clock, Globe, Mail, MapPin, Navigation, Phone, Users } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getBusinessBySlug } from "@/server/services/discovery";
import { categoryName } from "@/lib/deals";
import { DAY_SHORT, formatHHMM, zonedDayAndMinutes } from "@/lib/time";
import { formatDistance, pluralize } from "@/lib/utils";
import { SmartImage } from "@/components/smart-image";
import { BusinessAvatar } from "@/components/business-avatar";
import { FollowButton } from "@/components/follow-button";
import { DealCard } from "@/components/deals/deal-card";
import { EmptyState } from "@/components/empty-state";
import { MiniMap } from "@/components/mini-map";
import { ReportDialog } from "@/components/report-dialog";
import { Badge } from "@/components/ui/badge";
import { SignWelcome } from "@/components/business/sign-welcome";
import { SIGN_COOKIE } from "@/lib/promo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

async function load(slug: string) {
  const viewer = await getViewer();
  const loc = await getViewerLocation(viewer);
  return { viewer, data: await getBusinessBySlug(await getDb(), slug, loc, viewer?.id ?? null) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await load((await params).slug);
  if (!data) return { title: "Business not found" };
  const b = data.business;
  return {
    title: `${b.name} — deals in ${b.city}`,
    description: (b.description ?? `${categoryName(b.category_slug)} in ${b.city}`).slice(0, 160),
    openGraph: { images: b.cover_url ? [b.cover_url] : [] },
  };
}

export default async function BusinessPage({ params, searchParams }: Props) {
  const { viewer, data } = await load((await params).slug);
  if (!data) notFound();
  const { business: b, deals } = data;
  const sp = await searchParams;
  const fromSign = sp.from === "sign";
  // Auto-follow only right after signing up from the scan banner (the scan cookie proves they came from a sign).
  const scanned = (await cookies()).get(SIGN_COOKIE)?.value === b.id;
  const autoFollow = fromSign && sp.follow === "1" && !!viewer && !b.viewer_follows && scanned;
  const today = DAY_KEYS[zonedDayAndMinutes(new Date(), b.timezone).dow]!;
  const { minutes } = zonedDayAndMinutes(new Date(), b.timezone);
  const todays = b.hours[today];
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const openNow = todays ? minutes >= toMin(todays.open) && minutes < toMin(todays.close) : false;
  const address = `${b.address_line}, ${b.city}, ${b.state} ${b.zip}`;

  return (
    <div>
      <div className={`relative ${fromSign ? "h-32" : "h-52"} bg-mist sm:h-72 lg:mx-auto lg:mt-6 lg:h-80 lg:max-w-6xl lg:overflow-hidden lg:rounded-[24px]`}>
        <SmartImage src={b.cover_url} alt={`${b.name} storefront`} priority sizes="100vw" fallbackLabel={b.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Only the logo overlaps the cover; the name and details always sit below it. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <BusinessAvatar name={b.name} src={b.logo_url} className="relative z-10 -mt-10 size-20 shrink-0 rounded-2xl text-2xl ring-4 ring-white sm:-mt-12 sm:size-24" />
          <div className="min-w-0 flex-1 sm:pt-4 sm:pb-1">
            <h1 className="text-3xl font-extrabold sm:text-4xl">{b.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <Badge variant="soft" size="sm">{categoryName(b.category_slug)}</Badge>
              <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {b.city}{formatDistance(b.distance_miles) ? ` · ${formatDistance(b.distance_miles)}` : ""}</span>
              <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden /> {pluralize(b.follower_count, "follower")}</span>
              <span className={openNow ? "font-semibold text-lime-ink" : ""}>{openNow ? "Open now" : "Closed now"}</span>
            </div>
          </div>
          {fromSign && !b.viewer_follows ? null : (
            <FollowButton businessId={b.id} businessName={b.name} initial={b.viewer_follows} signedIn={!!viewer} size="default" className="sm:mb-1" />
          )}
        </div>

        {fromSign ? (
          <SignWelcome businessId={b.id} businessName={b.name} slug={b.slug} signedIn={!!viewer} following={b.viewer_follows} autoFollow={autoFollow} />
        ) : null}

        {b.description ? <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-ink/85">{b.description}</p> : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-label="Active deals">
            <h2 className="text-xl font-extrabold">Active deals {deals.length ? <span className="text-muted">· {deals.length}</span> : null}</h2>
            {deals.length ? (
              <div className="mt-4 grid gap-x-5 gap-y-8 sm:grid-cols-2">
                {deals.map((d) => <DealCard key={d.id} deal={d} signedIn={!!viewer} />)}
              </div>
            ) : (
              <EmptyState className="mt-4" icon={<Clock />} title="No deals right now">
                {b.viewer_follows
                  ? `You're following ${b.name}. We'll let you know the moment they post a deal.`
                  : `Follow ${b.name} and we'll notify you when they post a new deal.`}
              </EmptyState>
            )}
          </section>

          <aside className="grid content-start gap-5">
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <h2 className="font-extrabold">Hours</h2>
              <dl className="mt-3 grid gap-1.5 text-[15px]">
                {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                  const h = b.hours[DAY_KEYS[i]!];
                  const isToday = DAY_KEYS[i] === today;
                  return (
                    <div key={i} className={`flex justify-between ${isToday ? "font-bold" : ""}`}>
                      <dt>{DAY_SHORT[i]}{isToday ? " (today)" : ""}</dt>
                      <dd className={h ? "" : "text-muted"}>{h ? `${formatHHMM(h.open)} – ${formatHHMM(h.close)}` : "Closed"}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
              <div className="relative h-44 bg-mist"><MiniMap lat={b.lat} lng={b.lng} label={b.name} /></div>
              <div className="grid gap-3 p-5 text-[15px]">
                <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{address}</p>
                <a className="flex items-center gap-2 font-semibold hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}>
                  <Navigation className="size-4" aria-hidden /> Get directions
                </a>
                {b.phone ? <a className="flex items-center gap-2 hover:underline" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}><Phone className="size-4" aria-hidden />{b.phone}</a> : null}
                {b.website ? <a className="flex items-center gap-2 truncate hover:underline" href={b.website} target="_blank" rel="noopener noreferrer nofollow"><Globe className="size-4 shrink-0" aria-hidden />{b.website.replace(/^https?:\/\//, "")}</a> : null}
                {b.contact_email ? <a className="flex items-center gap-2 truncate hover:underline" href={`mailto:${b.contact_email}`}><Mail className="size-4 shrink-0" aria-hidden />{b.contact_email}</a> : null}
              </div>
            </div>
            <ReportDialog businessId={b.id} signedIn={!!viewer} />
          </aside>
        </div>
      </div>
    </div>
  );
}

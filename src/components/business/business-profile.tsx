import Link from "next/link";
import { Clock, Eye, Globe, Mail, MapPin, Navigation, Phone, Users } from "lucide-react";
import type { DealCard as Deal, PublicBusiness } from "@/server/services/discovery";
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
import { Button } from "@/components/ui/button";
import { SignWelcome } from "@/components/business/sign-welcome";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * A business's public page. With `previewToken` it renders a private preview: the same page, plus a
 * banner and a "Claim this page" button, with no following, saving or reporting.
 */
export function BusinessProfile({
  business: b,
  deals,
  signedIn,
  fromSign = false,
  autoFollow = false,
  previewToken,
}: {
  business: PublicBusiness;
  deals: Deal[];
  signedIn: boolean;
  fromSign?: boolean;
  autoFollow?: boolean;
  previewToken?: string;
}) {
  const preview = !!previewToken;
  const today = DAY_KEYS[zonedDayAndMinutes(new Date(), b.timezone).dow]!;
  const { minutes } = zonedDayAndMinutes(new Date(), b.timezone);
  const todays = b.hours[today];
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  // A preview's hours are placeholders until the owner claims it and sets their own.
  const hasHours = !preview && Object.values(b.hours ?? {}).some(Boolean);
  const openNow = todays ? minutes >= toMin(todays.open) && minutes < toMin(todays.close) : false;
  const address = `${b.address_line}, ${b.city}, ${b.state} ${b.zip}`;

  return (
    <div>
      {preview ? (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl bg-ink p-4 text-white sm:flex-row sm:items-center">
            <Eye className="hidden size-5 shrink-0 text-lime sm:block" aria-hidden />
            <p className="text-[15px] leading-snug">
              <strong className="font-extrabold">Preview made for {b.name.replace(/\.$/, "")}.</strong>{" "}
              <span className="text-white/75">This is how your page and deal would look on Frugal Center. Customers can&apos;t see it yet.</span>
            </p>
            <Button asChild variant="lime" className="shrink-0 sm:ml-auto">
              <Link href={`/p/${previewToken}/claim`}>Claim this page</Link>
            </Button>
          </div>
        </div>
      ) : null}
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
              {preview && !hasHours ? null : <span className={openNow ? "font-semibold text-lime-ink" : ""}>{openNow ? "Open now" : "Closed now"}</span>}
            </div>
          </div>
          {preview || (fromSign && !b.viewer_follows) ? null : (
            <FollowButton businessId={b.id} businessName={b.name} initial={b.viewer_follows} signedIn={signedIn} size="default" className="sm:mb-1" />
          )}
        </div>

        {fromSign && !preview ? (
          <SignWelcome businessId={b.id} businessName={b.name} slug={b.slug} signedIn={signedIn} following={b.viewer_follows} autoFollow={autoFollow} />
        ) : null}

        {b.description ? <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-ink/85">{b.description}</p> : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-label="Active deals">
            <h2 className="text-xl font-extrabold">Active deals {deals.length ? <span className="text-muted">· {deals.length}</span> : null}</h2>
            {deals.length ? (
              <div className="mt-4 grid gap-x-5 gap-y-8 sm:grid-cols-2">
                {deals.map((d) => (
                  <DealCard key={d.id} deal={d} signedIn={signedIn} preview={preview}
                    href={preview ? `/deals/${d.id}?p=${previewToken}` : undefined} />
                ))}
              </div>
            ) : (
              <EmptyState className="mt-4" icon={<Clock />} title="No deals right now">
                {preview
                  ? "Deals you post show up here."
                  : b.viewer_follows
                    ? `You're following ${b.name}. We'll let you know the moment they post a deal.`
                    : `Follow ${b.name} and we'll notify you when they post a new deal.`}
              </EmptyState>
            )}
          </section>

          <aside className="grid content-start gap-5">
            {preview && !hasHours ? null : (
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
            )}
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
            {preview ? null : <ReportDialog businessId={b.id} signedIn={signedIn} />}
          </aside>
        </div>
      </div>
    </div>
  );
}

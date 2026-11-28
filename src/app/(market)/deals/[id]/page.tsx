import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CalendarClock, ChevronLeft, Clock, Info, Megaphone, MapPin, Navigation, Package, ShieldCheck, Store } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { getViewerLocation } from "@/server/location";
import { getDealDetail, type DealDetail } from "@/server/services/discovery";
import { DEAL_TYPE_META, categoryName, priceDisplay, windowLabel } from "@/lib/deals";
import { formatDateTime, formatDayTime, timeLeft } from "@/lib/time";
import { formatDistance, formatMoney } from "@/lib/utils";
import { requestTime } from "@/lib/request-time";
import { Gallery } from "@/components/deals/gallery";
import { ClaimPanel } from "@/components/deals/claim-panel";
import { FavoriteButton } from "@/components/deals/favorite-button";
import { FollowButton } from "@/components/follow-button";
import { BusinessAvatar } from "@/components/business-avatar";
import { MiniMap } from "@/components/mini-map";
import { ReportDialog } from "@/components/report-dialog";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> };

/** `p` is a private preview's token, from its /p/<token> page. */
async function load(id: string, p?: string) {
  const viewer = await getViewer();
  const loc = await getViewerLocation(viewer);
  const deal = await getDealDetail(await getDb(), id, loc, viewer?.id ?? null, p ?? null);
  return { viewer, deal };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { deal } = await load((await params).id, (await searchParams).p);
  if (!deal) return { title: "Deal not found" };
  if (deal.is_preview) return { title: `Preview for ${deal.business_name}`, robots: { index: false, follow: false } };
  const p = priceDisplay(deal);
  const description = `${p.original ? `${p.headline} instead of ${p.original}` : p.headline} at ${deal.business_name}. ${deal.description ?? ""}`.slice(0, 160);
  return { title: `${deal.title} — ${deal.business_name}`, description, openGraph: { title: deal.title, description, images: deal.images.slice(0, 1) } };
}

function claimState(d: DealDetail): { claimable: boolean; reason: string | null } {
  if (d.is_preview) return { claimable: false, reason: "Example only, can't be claimed" };
  if (d.is_live) return { claimable: true, reason: null };
  if (d.status === "draft") return { claimable: false, reason: "Draft — not published" };
  if (d.status === "paused") return { claimable: false, reason: "Paused by the business" };
  if (d.status === "ended" || new Date(d.ends_at) <= new Date()) return { claimable: false, reason: "This deal has ended" };
  if (new Date(d.starts_at) > new Date()) return { claimable: false, reason: `Starts ${formatDayTime(d.starts_at, d.timezone)}` };
  if (d.type === "appointment") return { claimable: false, reason: "Fully booked" };
  return { claimable: false, reason: "Sold out" };
}

export default async function DealPage({ params, searchParams }: Props) {
  const previewToken = (await searchParams).p;
  const { viewer, deal: d } = await load((await params).id, previewToken);
  if (!d) notFound();
  const preview = d.is_preview;
  // A preview's business page is its private /p/<token> link, not the public profile.
  const businessHref = preview && previewToken ? `/p/${previewToken}` : `/business/${d.business_slug}`;
  const price = priceDisplay(d);
  const state = claimState(d);
  const meta = DEAL_TYPE_META[d.type];
  const left = d.quantity_total != null ? Math.max(0, d.quantity_total - d.claimed_count) : null;
  const savingsLabel = price.savingsCents ? `You save ${formatMoney(price.savingsCents)}` : price.variable ? `${price.badge} — discount applied to your bill` : null;
  const now = requestTime();
  const slots = d.slots.map((s) => ({ id: s.id, startsAt: new Date(s.starts_at).toISOString(), left: s.capacity - s.claimed_count, past: new Date(s.starts_at).getTime() <= now }));
  const panelProps = {
    dealId: d.id,
    isAppointment: d.type === "appointment",
    slots,
    timezone: d.timezone,
    durationMinutes: d.duration_minutes,
    state,
    activeClaimId: d.viewer_active_claim_id,
    signedIn: !!viewer,
    isMember: d.viewer_is_member,
    priceHeadline: price.headline,
    priceOriginal: price.original,
    savingsLabel,
  };
  const TypeIcon = d.type === "surplus" ? Package : d.type === "appointment" ? CalendarClock : d.type === "promotion" ? Megaphone : Clock;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${d.address_line}, ${d.city}, ${d.state} ${d.zip}`)}`;

  return (
    <div className="mx-auto max-w-6xl md:px-6 md:pt-6 lg:px-8">
      {preview && !d.viewer_is_member ? (
        <div className="mx-4 mb-4 flex flex-col gap-2 rounded-2xl bg-ink p-4 text-white sm:flex-row sm:items-center md:mx-0">
          {previewToken ? (
            <p className="text-[15px]"><strong className="font-extrabold">Preview made for {d.business_name.replace(/\.$/, "")}.</strong> <span className="text-white/75">Customers can&apos;t claim this deal yet.</span></p>
          ) : (
            <p className="text-[15px]"><strong className="font-extrabold">Example deal.</strong> <span className="text-white/75">{d.business_name.replace(/\.$/, "")} isn&apos;t on Frugal Center yet. This shows what their deals could look like, and it can&apos;t be claimed.</span></p>
          )}
          {previewToken ? <Link className="font-bold text-lime underline sm:ml-auto" href={`/p/${previewToken}/claim`}>Claim this page</Link> : null}
        </div>
      ) : null}
      {d.viewer_is_member && !d.is_live ? (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-[#fff4dc] p-3 text-sm font-semibold text-warning md:mx-0">
          <Info className="size-4" aria-hidden /> Preview — customers can&apos;t see this deal right now ({state.reason?.toLowerCase()}).
          <Link className="ml-auto underline" href={`/dashboard/deals/${d.id}`}>Edit</Link>
        </div>
      ) : null}
      <div className="relative">
        <Link href={preview ? businessHref : "/"} aria-label="Back" className="absolute top-3 left-3 z-10 grid size-10 place-items-center rounded-full bg-white/90 shadow backdrop-blur md:hidden">
          <ChevronLeft className="size-5" />
        </Link>
        {preview ? null : <FavoriteButton dealId={d.id} initial={d.is_favorite} signedIn={!!viewer} className="absolute top-3 right-3 z-10 size-10 md:top-4 md:right-4" />}
        <Gallery images={d.images.length ? d.images : d.business_cover ? [d.business_cover] : []} alt={d.title} />
      </div>

      <div className="grid gap-10 px-4 pt-6 md:px-0 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="lime">{price.badge}</Badge>
            <Badge variant="soft"><TypeIcon aria-hidden /> {meta.label}</Badge>
            <Badge variant="outline">{categoryName(d.category_slug)}</Badge>
          </div>
          <h1 className="mt-3 text-[28px] leading-tight font-extrabold sm:text-4xl">{d.title}</h1>

          <Link href={businessHref} className="mt-4 flex items-center gap-3 rounded-2xl p-1 -m-1 hover:bg-paper">
            <BusinessAvatar name={d.business_name} src={d.business_logo} className="size-11" />
            <div className="min-w-0">
              <p className="truncate font-bold">{d.business_name}</p>
              <p className="flex items-center gap-1 text-sm text-muted">
                <MapPin className="size-3.5" aria-hidden /> {d.address_line}
                {formatDistance(d.distance_miles) ? ` · ${formatDistance(d.distance_miles)}${d.distance_miles! < 0.1 ? "" : " away"}` : ""}
              </p>
            </div>
          </Link>

          {/* Type-specific availability */}
          <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper p-5" aria-label="Availability">
            <p className="flex items-center gap-2 text-sm font-bold"><TypeIcon className="size-4" aria-hidden /> {meta.label}</p>
            {d.type === "surplus" ? (
              <>
                <p className="mt-2 text-[15px]">
                  {left === 0 ? "Sold out" : `${left} of ${d.quantity_total} left`} · Pick up by <strong>{formatDayTime(d.ends_at, d.timezone)}</strong>
                </p>
                {d.quantity_total ? (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={d.quantity_total} aria-valuenow={left ?? 0} aria-label="Quantity remaining">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(4, ((left ?? 0) / d.quantity_total) * 100)}%` }} />
                  </div>
                ) : null}
              </>
            ) : d.type === "appointment" ? (
              <p className="mt-2 text-[15px]">
                {d.duration_minutes} minute appointment. Pick one of the specific open times {state.claimable ? "on the right" : "below"} — each is a real slot that opened up.
              </p>
            ) : d.type === "promotion" ? (
              <p className="mt-2 text-[15px]">
                Valid any time the business is open, through <strong>{formatDateTime(d.ends_at, d.timezone)}</strong>.
                {left != null ? ` ${left} of ${d.quantity_total} vouchers left.` : ""}
              </p>
            ) : (
              <p className="mt-2 text-[15px]">
                Valid <strong>{windowLabel(d)}</strong> only, through {formatDateTime(d.ends_at, d.timezone)}.
                {left != null ? ` ${left} vouchers left.` : ""}
              </p>
            )}
            {state.claimable && (d.type === "surplus" || d.type === "appointment") && new Date(d.type === "appointment" ? (d.next_slot_at ?? d.ends_at) : d.ends_at).getTime() - now < 24 * 3600000 ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold">
                <Clock className="size-3.5" aria-hidden /> {d.type === "appointment" ? "Next slot in" : "Ends in"} {timeLeft(d.type === "appointment" ? d.next_slot_at! : d.ends_at)}
              </p>
            ) : null}
          </section>

          {/* Mobile: slot picker inline */}
          {d.type === "appointment" ? (
            <div className="mt-6 scroll-mt-24 lg:hidden" id="slots">
              <ClaimPanel {...panelProps} />
            </div>
          ) : null}

          {d.description ? (
            <section className="mt-8">
              <h2 className="text-lg font-extrabold">About this deal</h2>
              <p className="mt-2 text-[15.5px] leading-relaxed whitespace-pre-line text-ink/85">{d.description}</p>
            </section>
          ) : null}

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="size-5" aria-hidden /> How to redeem</h2>
              <ol className="mt-3 grid gap-2 text-[15px] text-ink/85">
                <li>1. Claim the deal — it&apos;s free.</li>
                <li>2. Show your QR code or code to staff.</li>
                <li>3. Pay {d.business_name} directly.</li>
              </ol>
              {d.redemption_instructions ? <p className="mt-3 rounded-xl bg-paper p-3 text-sm">{d.redemption_instructions}</p> : null}
            </div>
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <h2 className="flex items-center gap-2 font-extrabold"><AlertCircle className="size-5" aria-hidden /> Good to know</h2>
              <ul className="mt-3 grid gap-2 text-[15px] text-ink/85">
                <li>Valid {formatDateTime(d.starts_at, d.timezone)} – {formatDateTime(d.ends_at, d.timezone)}</li>
                <li>Limit {d.per_customer_limit} per customer</li>
                {price.variable ? <li>Staff confirm your bill total when you redeem</li> : null}
                {d.restrictions ? <li className="whitespace-pre-line">{d.restrictions}</li> : null}
              </ul>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-extrabold">Where you&apos;ll be</h2>
            <div className="relative mt-3 h-64 overflow-hidden rounded-[var(--radius-card)] border border-line bg-mist">
              <MiniMap lat={d.lat} lng={d.lng} label={d.business_name} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px]">{d.address_line}, {d.city}, {d.state} {d.zip}</p>
              <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline">
                <Navigation className="size-4" aria-hidden /> Directions
              </a>
            </div>
          </section>

          <section className="mt-8 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line p-5 sm:flex-row sm:items-center">
            <BusinessAvatar name={d.business_name} src={d.business_logo} className="size-14 text-lg" />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{d.business_name}</p>
              <p className="line-clamp-2 text-sm text-muted">{d.business_description ?? categoryName(d.category_slug)}</p>
            </div>
            <div className="flex gap-2">
              <FollowButton businessId={d.business_id} businessName={d.business_name} initial={d.viewer_follows} signedIn={!!viewer} />
              <Link href={businessHref} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-semibold hover:bg-paper">
                <Store className="size-4" aria-hidden /> Profile
              </Link>
            </div>
          </section>

          <div className="mt-6 mb-4">
            {preview ? null : <ReportDialog dealId={d.id} signedIn={!!viewer} />}
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[22px] border border-line p-6 shadow-[var(--shadow-soft)]">
            <ClaimPanel {...panelProps} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky claim bar */}
      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-lg md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold">{price.headline}</span>
              {price.original ? <span className="text-sm text-muted line-through">{price.original}</span> : null}
            </p>
            <p className="truncate text-xs font-semibold text-lime-ink">{savingsLabel}</p>
          </div>
          <div className="ml-auto w-44 shrink-0">
            {d.type === "appointment" && state.claimable && !d.viewer_active_claim_id ? (
              <a href="#slots" className="inline-flex h-14 w-full items-center justify-center rounded-full bg-lime text-[15px] font-extrabold text-ink">Pick a time ↑</a>
            ) : (
              <ClaimPanel {...panelProps} compact />
            )}
          </div>
        </div>
      </div>
      <div className="h-24 lg:hidden" aria-hidden />
    </div>
  );
}

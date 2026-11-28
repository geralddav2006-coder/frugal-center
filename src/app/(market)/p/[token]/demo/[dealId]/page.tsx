import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CalendarClock, ChevronLeft, Clock, PartyPopper, ScanLine, Sun } from "lucide-react";
import { getViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { getViewerLocation } from "@/server/location";
import { getDealDetail } from "@/server/services/discovery";
import { DEAL_TYPE_META, priceDisplay, windowLabel } from "@/lib/deals";
import { formatDayTime } from "@/lib/time";
import { BusinessAvatar } from "@/components/business-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ token: string; dealId: string }>; searchParams: Promise<{ slot?: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo voucher", robots: { index: false, follow: false } };

/**
 * What a customer sees right after claiming, shown to an owner from their private preview link.
 * Nothing is claimed: the code is a sample and the QR code just opens the preview.
 */
export default async function DemoVoucherPage({ params, searchParams }: Props) {
  const { token, dealId } = await params;
  const { slot: slotId } = await searchParams;
  const viewer = await getViewer();
  const d = await getDealDetail(await getDb(), dealId, await getViewerLocation(viewer), viewer?.id ?? null, token);
  if (!d || !d.is_preview) notFound();
  const price = priceDisplay(d);
  const previewUrl = `${env.appUrl}/p/${token}`;
  const qrSvg = await QRCode.toString(previewUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#191919", light: "#ffffff" } });
  const slot = d.slots.find((s) => s.id === slotId) ?? d.slots.find((s) => new Date(s.starts_at) > new Date());
  const name = d.business_name.replace(/\.$/, "");

  return (
    <div className="mx-auto max-w-md px-4 pt-4 pb-10 sm:pt-8">
      <Link href={`/deals/${d.id}?p=${token}`} className="mb-4 inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Back to the deal
      </Link>

      <p className="mb-3 rounded-2xl bg-ink p-4 text-[15px] text-white">
        <strong className="font-extrabold">Demo for {name}.</strong>{" "}
        <span className="text-white/75">This is what a customer sees right after tapping Claim. Nothing was claimed.</span>
      </p>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-lime p-4">
        <PartyPopper className="size-6 shrink-0" aria-hidden />
        <div>
          <p className="font-extrabold">Deal claimed!</p>
          <p className="text-sm">Show this screen at {name} to redeem.</p>
        </div>
      </div>

      <article className="overflow-hidden rounded-[26px] border border-line bg-white shadow-[var(--shadow-lift)]" aria-label="Demo voucher">
        <header className="flex items-center gap-3 bg-ink p-5 text-white">
          <BusinessAvatar name={d.business_name} src={d.business_logo} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/70">{d.business_name}</p>
            <h1 className="truncate text-lg leading-tight font-extrabold">{d.title}</h1>
          </div>
          <Badge variant="lime">Ready to use</Badge>
        </header>
        <div className="p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold">{price.headline}</span>
              {price.original ? <span className="text-muted line-through">{price.original}</span> : null}
            </div>
            <span className="text-sm font-bold text-lime-ink">{price.badge}</span>
          </div>
          {d.type === "appointment" && slot ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-paper p-3 text-[15px] font-semibold">
              <CalendarClock className="size-4" aria-hidden /> {formatDayTime(slot.starts_at, d.timezone)} · {d.duration_minutes} min
            </p>
          ) : null}
          {d.type === "slow_hours" && windowLabel(d) ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-paper p-3 text-[15px] font-semibold">
              <Sun className="size-4" aria-hidden /> Valid {windowLabel(d)}
            </p>
          ) : null}
          <div className="mx-auto mt-6 aspect-square w-full max-w-[260px] rounded-2xl border border-line bg-white p-4 [&_svg]:size-full" role="img" aria-label="Sample QR code" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="mt-6 text-center">
            <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">Or give staff this code</p>
            <p className="mt-1.5 font-mono text-[34px] font-bold tracking-[0.12em] tabular">DEMO-K7QM</p>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold">
            <Clock className="size-4" aria-hidden /> {d.type === "surplus" ? `Pick up by ${formatDayTime(d.ends_at, d.timezone)}` : "Good until the deal ends"}
          </p>
        </div>
        <div className="border-t border-dashed border-line px-6 py-5 text-sm">
          <p className="text-muted">{DEAL_TYPE_META[d.type].label} · {d.address_line}, {d.city}</p>
        </div>
      </article>

      <section className="mt-6 rounded-[22px] border border-line p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><ScanLine className="size-5" aria-hidden /> What your staff do</h2>
        <ol className="mt-3 grid gap-2 text-[15px] text-ink/85">
          <li>1. The customer shows this screen at the counter.</li>
          <li>2. Open Frugal Center on any phone and tap <strong>Redeem</strong>.</li>
          <li>3. Scan the QR code, or type the code, and tap Confirm. Done.</li>
          <li>4. The customer pays you directly. Frugal Center takes no cut.</li>
        </ol>
      </section>

      <div className="mt-6 grid gap-3">
        <Button asChild size="lg" variant="lime"><Link href={`/p/${token}/claim`}>Claim {name} on Frugal Center</Link></Button>
        <Button asChild variant="ghost"><Link href={`/p/${token}`}>Back to the preview</Link></Button>
      </div>
    </div>
  );
}

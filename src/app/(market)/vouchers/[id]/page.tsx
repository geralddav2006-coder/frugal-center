import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CalendarClock, CheckCircle2, ChevronLeft, Clock, MapPin, Navigation, PartyPopper, Sun, XCircle } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { getVoucher } from "@/server/services/claims";
import { DEAL_TYPE_META, priceDisplay, windowLabel } from "@/lib/deals";
import { formatDateTime, formatDayTime } from "@/lib/time";
import { formatMoney } from "@/lib/utils";
import { BusinessAvatar } from "@/components/business-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelVoucher, CopyCode, Countdown, VoucherAutoRefresh } from "@/components/vouchers/voucher-live";

export const metadata: Metadata = { title: "Your voucher", robots: { index: false } };

export default async function VoucherPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const viewer = await requireViewer(`/vouchers/${id}`);
  const v = await getVoucher(await getDb(), viewer.id, id);
  if (!v) notFound();

  const t = v.terms;
  const price = priceDisplay(t);
  const qrSvg = v.state === "active"
    ? await QRCode.toString(`${env.appUrl}/dashboard/redeem?t=${v.qr_token}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#191919", light: "#ffffff" } })
    : null;
  const status = {
    active: <Badge variant="lime">Ready to use</Badge>,
    redeemed: <Badge variant="success"><CheckCircle2 aria-hidden /> Redeemed</Badge>,
    canceled: <Badge variant="soft"><XCircle aria-hidden /> Canceled</Badge>,
    expired: <Badge variant="danger"><Clock aria-hidden /> Expired</Badge>,
  }[v.state];

  return (
    <div className="mx-auto max-w-md px-4 pt-4 pb-10 sm:pt-8">
      <VoucherAutoRefresh active={v.state === "active"} />
      <Link href="/my-deals" className="mb-4 inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> My Deals
      </Link>

      {isNew && v.state === "active" ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-lime p-4">
          <PartyPopper className="size-6 shrink-0" aria-hidden />
          <div>
            <p className="font-extrabold">Deal claimed!</p>
            <p className="text-sm">Show this screen at {t.business_name} to redeem.</p>
          </div>
        </div>
      ) : null}

      <article className="overflow-hidden rounded-[26px] border border-line bg-white shadow-[var(--shadow-lift)]" aria-label="Voucher">
        <header className="flex items-center gap-3 bg-ink p-5 text-white">
          <BusinessAvatar name={v.business_name} src={v.business_logo} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/70">{v.business_name}</p>
            <h1 className="truncate text-lg leading-tight font-extrabold">{t.title}</h1>
          </div>
          {status}
        </header>

        <div className="p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold">{price.headline}</span>
              {price.original ? <span className="text-muted line-through">{price.original}</span> : null}
            </div>
            <span className="text-sm font-bold text-lime-ink">{price.badge}</span>
          </div>

          {t.slot_starts_at ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-paper p-3 text-[15px] font-semibold">
              <CalendarClock className="size-4" aria-hidden /> {formatDayTime(t.slot_starts_at, t.timezone)} · {t.duration_minutes} min
            </p>
          ) : null}
          {t.type === "slow_hours" && windowLabel(t) ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-paper p-3 text-[15px] font-semibold">
              <Sun className="size-4" aria-hidden /> Valid {windowLabel(t)}
            </p>
          ) : null}

          {v.state === "active" ? (
            <>
              <div className="relative mt-6">
                <div className="mx-auto aspect-square w-full max-w-[260px] rounded-2xl border border-line bg-white p-4 [&_svg]:size-full" role="img" aria-label="QR code for staff to scan" dangerouslySetInnerHTML={{ __html: qrSvg! }} />
              </div>
              <div className="mt-6 text-center">
                <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">Or give staff this code</p>
                <p className="mt-1.5 font-mono text-[34px] font-bold tracking-[0.12em] tabular" aria-label={`Code ${v.code.split("").join(" ")}`}>{v.code}</p>
                <CopyCode code={v.code} />
              </div>
              <p className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold">
                <Clock className="size-4" aria-hidden /> <Countdown to={new Date(v.expires_at).toISOString()} />
                <span className="font-normal text-muted">· {formatDateTime(v.expires_at, t.timezone)}</span>
              </p>
            </>
          ) : v.state === "redeemed" ? (
            <div className="mt-6 rounded-2xl bg-lime-soft p-6 text-center">
              <CheckCircle2 className="mx-auto size-12 text-lime-ink" aria-hidden />
              <p className="mt-2 text-xl font-extrabold">Redeemed</p>
              <p className="text-sm text-muted">{formatDateTime(v.redeemed_at!, t.timezone)}</p>
              {v.savings_cents != null ? (
                <p className="mt-3 text-lg font-extrabold text-lime-ink">You saved {formatMoney(v.savings_cents)}</p>
              ) : null}
              <Button asChild variant="outline" className="mt-4"><Link href="/savings">See your savings</Link></Button>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-paper p-6 text-center">
              <p className="text-lg font-extrabold">{v.state === "canceled" ? "This voucher was canceled" : "This voucher has expired"}</p>
              <p className="mt-1 text-sm text-muted">It can no longer be redeemed.</p>
              <Button asChild className="mt-4"><Link href={`/deals/${v.deal_id}`}>View deal</Link></Button>
            </div>
          )}
        </div>

        <div className="relative border-t border-dashed border-line px-6 py-5">
          <span aria-hidden className="absolute -top-3 -left-3 size-6 rounded-full border border-line bg-white" />
          <span aria-hidden className="absolute -top-3 -right-3 size-6 rounded-full border border-line bg-white" />
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Type</dt><dd className="font-semibold">{DEAL_TYPE_META[t.type].label}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Claimed</dt><dd className="font-semibold">{formatDateTime(v.created_at, t.timezone)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Where</dt><dd className="text-right font-semibold">{v.address_line}, {v.city}</dd></div>
          </dl>
          {t.redemption_instructions ? <p className="mt-4 rounded-xl bg-paper p-3 text-sm">{t.redemption_instructions}</p> : null}
          {t.restrictions ? <p className="mt-2 text-xs text-muted">{t.restrictions}</p> : null}
          {price.variable ? <p className="mt-2 text-xs text-muted">Staff will confirm your bill total and apply the discount when you redeem.</p> : null}
        </div>
      </article>

      {v.state === "active" ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted">
          <Sun className="size-4" aria-hidden /> Turn up your screen brightness for faster scanning.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${v.address_line}, ${v.city}`)}`} target="_blank" rel="noopener noreferrer">
            <Navigation /> Directions
          </a>
        </Button>
        <Button asChild variant="outline"><Link href={`/business/${v.business_slug}`}><MapPin /> Business</Link></Button>
        {v.state === "active" ? <CancelVoucher claimId={v.id} /> : null}
      </div>
    </div>
  );
}

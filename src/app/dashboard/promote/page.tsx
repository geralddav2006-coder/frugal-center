import type { Metadata } from "next";
import Link from "next/link";
import { Download, Megaphone, MessageCircle, Printer, QrCode, ScanLine, UserPlus, Users } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { getPromoBusiness, getPromoStats } from "@/server/services/promote";
import { displayUrl, qrSvg } from "@/server/promo-qr";
import {
  PIECE_META, PRINT_PIECES, PROMO_MESSAGES, checkoutLine, defaultMessage, isPromoMessage, promoUrl, type PrintPiece, type PromoMessage,
} from "@/lib/promo";
import { ScaledSign } from "@/components/promo/signs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Promote your business" };

const PREVIEW_WIDTH: Record<PrintPiece, number> = { counter: 168, tent: 184, decal: 200, sticker: 184 };

export default async function PromotePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { membership } = await requireBusiness("/dashboard/promote", ["owner", "manager"]);
  const db = await getDb();
  const [biz, stats] = await Promise.all([getPromoBusiness(db, membership.business_id), getPromoStats(db, membership.business_id)]);
  if (!biz) return null;
  const sp = await searchParams;
  const recommended = defaultMessage(biz.top_type);
  const message: PromoMessage = isPromoMessage(sp.msg) ? sp.msg : recommended;
  const shareUrl = promoUrl(env.appUrl, biz.slug, "link");
  const previews = await Promise.all(
    PRINT_PIECES.map(async (piece) => {
      const url = promoUrl(env.appUrl, biz.slug, piece);
      return { piece, qr: await qrSvg(url), short: displayUrl(url) };
    }),
  );
  const line = checkoutLine(message);

  const tiles = [
    { icon: ScanLine, label: "Sign scans", value: stats.scans30, note: "Last 30 days" },
    { icon: UserPlus, label: "Followers from signs", value: stats.signFollowers30, note: `Last 30 days · ${stats.signFollowersAll} all time` },
    { icon: Users, label: "Total followers", value: stats.followers, note: "Notified when you post a deal" },
  ];

  return (
    <div className="max-w-6xl">
      <p className="flex items-center gap-2 text-sm font-semibold text-lime-ink"><Megaphone className="size-4" aria-hidden /> In-store promotion</p>
      <h1 className="mt-1 text-3xl font-extrabold">Promote your business</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Put Frugal Center signs in your shop. Customers scan the code, follow you in one tap, and get a notification every time you post a deal.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map(({ icon: Icon, label, value, note }, i) => (
          <div key={label} className={cn("rounded-2xl border p-3 sm:rounded-[var(--radius-card)] sm:p-5", i === 1 ? "border-ink bg-ink text-white" : "border-line bg-white")}>
            <p className={cn("flex items-center gap-2 text-xs leading-tight font-semibold sm:text-sm", i === 1 ? "text-white/70" : "text-muted")}><Icon className="hidden size-4 shrink-0 sm:block" aria-hidden /> {label}</p>
            <p className={cn("mt-1.5 text-3xl font-extrabold tabular sm:mt-2 sm:text-4xl", i === 1 && "text-lime")}>{value}</p>
            <p className={cn("mt-1 hidden text-xs sm:block", i === 1 ? "text-white/60" : "text-muted")}>{note}</p>
          </div>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="msg-h">
        <h2 id="msg-h" className="text-xl font-extrabold">1. Pick your message</h2>
        <p className="mt-1 text-sm text-muted">Signs work best when they name the kind of deal you run.</p>
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {(Object.keys(PROMO_MESSAGES) as PromoMessage[]).map((key) => {
            const active = key === message;
            return (
              <Link
                key={key}
                href={`/dashboard/promote?msg=${key}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition",
                  active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
                )}
              >
                {PROMO_MESSAGES[key].label}
                {key === recommended ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", active ? "bg-lime text-ink" : "bg-lime-soft text-lime-ink")}>Recommended</span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="mt-4 rounded-2xl bg-paper p-4">
          <p className="font-display text-lg font-extrabold">{PROMO_MESSAGES[message].headline}</p>
          <p className="mt-1 text-sm text-muted">{PROMO_MESSAGES[message].sub}</p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="print-h">
        <h2 id="print-h" className="text-xl font-extrabold">2. Print your signs</h2>
        <p className="mt-1 text-sm text-muted">Each sign has your own QR code. Print at home or at any print shop, at 100% scale.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {previews.map(({ piece, qr, short }) => (
            <article key={piece} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-4">
              <div className="grid h-[260px] place-items-center rounded-xl bg-paper">
                <ScaledSign piece={piece} width={PREVIEW_WIDTH[piece]} name={biz.name} logoUrl={biz.logo_url} message={message} qrSvg={qr} shortUrl={short} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold">{PIECE_META[piece].label}</h3>
              <p className="text-sm text-muted">{PIECE_META[piece].size} · {PIECE_META[piece].where}</p>
              <p className="mt-1 text-xs font-semibold text-muted">{stats.byPiece30[piece] ?? 0} scans in the last 30 days</p>
              <Button asChild variant="lime" className="mt-4">
                <Link href={`/print/promo/${piece}?msg=${message}`} target="_blank"><Printer /> Print / Save PDF</Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6" aria-labelledby="share-h">
          <h2 id="share-h" className="flex items-center gap-2 text-xl font-extrabold"><QrCode className="size-5" aria-hidden /> 3. Share your link</h2>
          <p className="mt-1 text-sm text-muted">Put it in your Instagram bio, website or emails. It opens your page with a follow button, and scans are counted here too.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={shareUrl} aria-label="Your Frugal Center link" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-sm font-semibold" />
            <CopyButton text={shareUrl} label="Copy link" />
          </div>
          <Button asChild variant="ghost" className="mt-2 px-0 hover:bg-transparent">
            <a href="/api/promo/qr?p=link" download><Download /> Download QR code (PNG)</a>
          </Button>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6" aria-labelledby="say-h">
          <h2 id="say-h" className="flex items-center gap-2 text-xl font-extrabold"><MessageCircle className="size-5" aria-hidden /> Say it at checkout</h2>
          <p className="mt-1 text-sm text-muted">Staff mentioning it gets more follows than any sign. Share this line with your team.</p>
          <blockquote className="mt-4 rounded-2xl bg-lime-soft p-4 text-[15px] font-semibold text-ink">&ldquo;{line}&rdquo;</blockquote>
          <div className="mt-3"><CopyButton text={line} label="Copy line" /></div>
        </section>
      </div>

      <section className="mt-10 rounded-[var(--radius-card)] bg-paper p-5 sm:p-6" aria-labelledby="tips-h">
        <h2 id="tips-h" className="text-lg font-extrabold">Where signs work best</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink/80 sm:grid-cols-2">
          <li>• <strong>At the register,</strong> where people wait with their phone in hand.</li>
          <li>• <strong>On tables,</strong> so people scan while they sit.</li>
          <li>• <strong>On the door,</strong> so passers-by know you post deals.</li>
          <li>• <strong>On bags and boxes,</strong> so takeaway customers come back.</li>
        </ul>
      </section>
    </div>
  );
}

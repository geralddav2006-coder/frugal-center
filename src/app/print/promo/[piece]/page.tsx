import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { getPromoBusiness } from "@/server/services/promote";
import { displayUrl, qrSvg } from "@/server/promo-qr";
import { PIECE_META, defaultMessage, isPrintPiece, isPromoMessage, promoUrl } from "@/lib/promo";
import { PIECE_SIZE, Sign } from "@/components/promo/signs";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Print sign", robots: { index: false } };

type Props = { params: Promise<{ piece: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Full-size printable sign. "Print / Save as PDF" uses the browser's print dialog at the exact paper size. */
export default async function PrintPromoPage({ params, searchParams }: Props) {
  const { piece } = await params;
  if (!isPrintPiece(piece)) notFound();
  const sp = await searchParams;
  const { membership } = await requireBusiness(`/print/promo/${piece}`, ["owner", "manager"]);
  const biz = await getPromoBusiness(await getDb(), membership.business_id);
  if (!biz) notFound();
  const message = isPromoMessage(sp.msg) ? sp.msg : defaultMessage(biz.top_type);
  const url = promoUrl(env.appUrl, biz.slug, piece);
  const size = PIECE_SIZE[piece];

  return (
    <div className="min-h-dvh bg-mist print:bg-white">
      <style>{`@page { size: ${size.page}; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/dashboard/promote?msg=${message}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Back to Promote
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <p className="hidden text-sm text-muted sm:block">
              {PIECE_META[piece].label} · {PIECE_META[piece].size} · print at 100% or <strong className="text-ink">Save as PDF</strong>
            </p>
            <PrintButton />
          </div>
        </div>
      </div>
      <div className="flex justify-center overflow-x-auto p-6 print:block print:overflow-visible print:p-0">
        <div className="shrink-0 shadow-[var(--shadow-lift)] print:shadow-none">
          <Sign piece={piece} name={biz.name} logoUrl={biz.logo_url} message={message} qrSvg={await qrSvg(url)} shortUrl={displayUrl(url)} />
        </div>
      </div>
    </div>
  );
}

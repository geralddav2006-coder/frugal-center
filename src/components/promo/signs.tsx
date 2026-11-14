import { LogoMark } from "@/components/brand";
import { BusinessAvatar } from "@/components/business-avatar";
import { PROMO_MESSAGES, type PrintPiece, type PromoMessage } from "@/lib/promo";
import { cn } from "@/lib/utils";

/**
 * Printable in-store signs, laid out at real size (CSS inches = 96px).
 * The same components render the small previews on the Promote page (scaled down) and the print pages.
 */

export interface SignProps {
  name: string;
  logoUrl: string | null;
  message: PromoMessage;
  qrSvg: string;
  shortUrl: string; // printed under the QR for people who can't scan
}

/** Exact paper sizes in CSS pixels (96 per inch). */
export const PIECE_SIZE: Record<PrintPiece, { w: number; h: number; page: string }> = {
  counter: { w: 480, h: 672, page: "5in 7in" },
  tent: { w: 816, h: 1056, page: "8.5in 11in" },
  decal: { w: 576, h: 576, page: "6in 6in" },
  sticker: { w: 816, h: 1056, page: "8.5in 11in" },
};

const printExact = { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as const;

function Qr({ svg, className }: { svg: string; className?: string }) {
  return <div className={cn("[&>svg]:block [&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code" role="img" />;
}

function Brand({ dark, size = 34 }: { dark?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="shrink-0" title="Frugal Center" />
      <span className={cn("font-display font-extrabold whitespace-nowrap", dark ? "text-white" : "text-ink")} style={{ fontSize: size * 0.56 }}>
        Frugal Center
      </span>
    </div>
  );
}

const PERKS = ["Free", "No spam", "Pay in store"];

export function CounterCard({ name, logoUrl, message, qrSvg, shortUrl }: SignProps) {
  const m = PROMO_MESSAGES[message];
  return (
    <div className="flex flex-col overflow-hidden bg-white text-ink" style={{ width: 480, height: 672, ...printExact }}>
      <div className="flex items-center justify-between bg-ink px-8 py-5">
        <Brand dark />
        <span className="rounded-full bg-lime px-3 py-1 text-[12px] font-extrabold tracking-wide text-ink">LOCAL DEALS</span>
      </div>
      <div className="flex flex-1 flex-col items-center px-9 pt-7 pb-6 text-center">
        <div className="flex items-center gap-3">
          <BusinessAvatar name={name} src={logoUrl} className="size-11 rounded-xl text-base" />
          <p className="text-[19px] font-bold">{name}</p>
        </div>
        <p className="mt-5 font-display text-[33px] leading-[1.08] font-extrabold tracking-[-0.01em]">{m.headline}</p>
        <div className="mt-6 rounded-[22px] border-[5px] border-lime bg-white p-3">
          <Qr svg={qrSvg} className="size-[196px]" />
        </div>
        <p className="mt-5 max-w-[34ch] text-[17px] leading-snug font-semibold text-ink/80">{m.sub}</p>
        <div className="mt-auto flex items-center gap-2 pt-4">
          {PERKS.map((p) => (
            <span key={p} className="rounded-full bg-lime-soft px-3 py-1 text-[13px] font-bold text-lime-ink">{p}</span>
          ))}
        </div>
        <p className="mt-3 text-[12px] font-semibold text-muted">{shortUrl}</p>
      </div>
    </div>
  );
}

function TentPanel({ name, logoUrl, message, qrSvg, shortUrl }: SignProps) {
  const m = PROMO_MESSAGES[message];
  return (
    <div className="flex h-full items-center gap-10 px-14">
      <div className="min-w-0 flex-1">
        <Brand />
        <p className="mt-6 font-display text-[40px] leading-[1.05] font-extrabold tracking-[-0.01em]">{m.headline}</p>
        <p className="mt-4 text-[19px] leading-snug font-semibold text-ink/75">{m.sub}</p>
        <div className="mt-6 flex items-center gap-3">
          <BusinessAvatar name={name} src={logoUrl} className="size-10 rounded-xl text-sm" />
          <p className="text-[18px] font-bold">{name}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <div className="rounded-[24px] border-[6px] border-lime bg-white p-3">
          <Qr svg={qrSvg} className="size-[220px]" />
        </div>
        <p className="mt-3 text-[14px] font-bold">{PERKS.join(" · ")}</p>
        <p className="mt-1 text-[12px] font-semibold text-muted">{shortUrl}</p>
      </div>
    </div>
  );
}

/** Letter paper folded in half across the middle: the top panel is upside down so both faces read correctly. */
export function TableTent(props: SignProps) {
  return (
    <div className="relative bg-white text-ink" style={{ width: 816, height: 1056, ...printExact }}>
      <div className="absolute inset-x-0 top-0 h-1/2 rotate-180 border-t-[10px] border-lime">
        <TentPanel {...props} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 border-t-[10px] border-lime">
        <TentPanel {...props} />
      </div>
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink/25 print:border-ink/15" aria-hidden />
      <p className="absolute top-1/2 right-4 -translate-y-1/2 bg-white px-2 text-[10px] font-semibold text-muted">fold</p>
    </div>
  );
}

export function WindowDecal({ name, qrSvg, shortUrl }: SignProps) {
  return (
    <div className="flex flex-col items-center justify-between bg-ink p-10 text-center text-white" style={{ width: 576, height: 576, ...printExact }}>
      <LogoMark className="size-20 rounded-[22%]" />
      <div>
        <p className="text-[18px] font-bold text-lime">Find our deals on</p>
        <p className="mt-1 font-display text-[54px] leading-none font-extrabold">Frugal Center</p>
        <p className="mt-3 text-[17px] font-semibold text-white/70">{name}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-white p-2.5">
          <Qr svg={qrSvg} className="size-[124px]" />
        </div>
        <div className="text-left">
          <p className="text-[20px] font-extrabold">Scan to follow us</p>
          <p className="mt-1 text-[14px] text-white/70">{PERKS.join(" · ")}</p>
          <p className="mt-1 text-[12px] text-white/50">{shortUrl}</p>
        </div>
      </div>
    </div>
  );
}

/** 12 round stickers (about 2.4 in) on letter paper, with margins most printers can reach. Print on label paper or cut by hand. */
export function StickerSheet({ name, qrSvg }: SignProps) {
  return (
    <div className="grid content-center justify-center gap-x-[28px] gap-y-[20px] bg-white" style={{ width: 816, height: 1056, gridTemplateColumns: "repeat(3, 228px)", ...printExact }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex size-[228px] flex-col items-center justify-center rounded-full border-[6px] border-lime bg-white text-center text-ink">
          <div className="flex items-center gap-1.5">
            <LogoMark className="size-5 rounded-[22%]" />
            <span className="font-display text-[12px] font-extrabold">Frugal Center</span>
          </div>
          <Qr svg={qrSvg} className="mt-2 size-[100px]" />
          <p className="mt-2 text-[14px] leading-tight font-extrabold">Next time, save.</p>
          <p className="max-w-[170px] truncate text-[11px] font-semibold text-muted">Follow {name}</p>
        </div>
      ))}
    </div>
  );
}

export function Sign({ piece, ...props }: SignProps & { piece: PrintPiece }) {
  if (piece === "counter") return <CounterCard {...props} />;
  if (piece === "tent") return <TableTent {...props} />;
  if (piece === "decal") return <WindowDecal {...props} />;
  return <StickerSheet {...props} />;
}

/** Shrinks a real-size sign to fit a preview box of the given width. */
export function ScaledSign({ piece, width, ...props }: SignProps & { piece: PrintPiece; width: number }) {
  const size = PIECE_SIZE[piece];
  const scale = width / size.w;
  return (
    <div className="relative overflow-hidden rounded-lg shadow-[var(--shadow-soft)] ring-1 ring-line" style={{ width, height: Math.round(size.h * scale) }} aria-hidden>
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Sign piece={piece} {...props} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/** FC monogram on lime. Mirrors /public/logo-mark.svg — swap both to rebrand. */
export function LogoMark({ className, title = "Frugal Center" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("size-8 shrink-0 rounded-[22%]", className)} role="img" aria-label={title}>
      <rect width="100" height="100" fill="#5CE65C" />
      <g transform="translate(50 50) skewX(-10) translate(-50 -50)" fill="#191919">
        <rect x="29" y="34" width="8.5" height="32" />
        <rect x="29" y="34" width="20" height="8" />
        <rect x="29" y="47.5" width="15" height="7.5" />
        <path d="M71.2 41.3 A11.5 11.5 0 1 0 71.2 58.7" fill="none" stroke="#191919" strokeWidth="8" />
      </g>
    </svg>
  );
}

export function Logo({ href = "/", className, suffix }: { href?: string; className?: string; suffix?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-lg", className)} aria-label="Frugal Center home">
      <LogoMark />
      <span className="font-display text-[16px] font-extrabold whitespace-nowrap">
        Frugal Center{suffix ? <span className="hidden font-semibold text-muted sm:inline"> {suffix}</span> : null}
      </span>
    </Link>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/** FC¢ monogram on lime. Mirrors /public/logo-mark.svg — swap both to rebrand. */
export function LogoMark({ className, title = "Frugal Center" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="104 108 1040 1040" className={cn("size-8 shrink-0 rounded-[22%]", className)} role="img" aria-label={title}>
      <rect width="1254" height="1254" fill="#2EF27A" />
      <path fill="#191919" fillRule="evenodd" d="M365 433H696L682 463L640 517H435L414 580H599L589 606L549 665H385L330 821H220ZM884 379H920L902 435H986L1027 497L1008 550H913L922 518H874L805 736H874L887 698H980L962 762L892 821H780L763 878H727L744 821H648L593 748L664 517L761 435H866ZM786 518H841L773 736H715L698 709L748 551Z" />
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

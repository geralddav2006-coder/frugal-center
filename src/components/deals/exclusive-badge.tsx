import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Exclusive" pill for deals offered only through Frugal Center. */
export function ExclusiveBadge({ className, long }: { className?: string; long?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[12px] font-extrabold tracking-wide whitespace-nowrap text-white shadow-sm",
        className,
      )}
    >
      <Gem className="size-3.5 text-lime" strokeWidth={2.4} aria-hidden />
      {long ? "Frugal Center exclusive" : "Exclusive"}
    </span>
  );
}
